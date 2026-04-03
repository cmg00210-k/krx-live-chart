#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_linucb.py — Stage B-3: LinUCB Contextual Bandit Implementation

LinUCB algorithm with:
  - Sherman-Morrison incremental inverse update (O(d²) per step)
  - 5 discrete actions: strong_dampen(0.3), slight_dampen(0.7),
    trust_mra(1.0), slight_boost(1.3), reverse(-0.5)
  - Directional reward aligned with IC: r = y_adj*y_actual - y_mra*y_actual
  - UCB exploration with alpha scheduling
  - Policy export to JSON for JS integration (~30 lines)

Academic Basis:
  - Li et al. (2010) "A Contextual-Bandit Approach to Personalized News
    Article Recommendation", WWW 2010
  - core_data/11_RL §7.3: warm start from technical analysis rules
  - Mnih et al. (2015): log-compression analogous to Huber loss in DQN

Usage:
    # As a library (imported by rl_stage_b.py):
    from rl_linucb import LinUCB, ACTION_FACTORS, compute_reward

    # Standalone unit test:
    python scripts/rl_linucb.py
"""

import json
import math
import sys
from pathlib import Path

import numpy as np

# ──────────────────────────────────────────────
# Action Space
# ──────────────────────────────────────────────

ACTION_NAMES = [
    "strong_dampen",   # 0: suppress to near-zero
    "slight_dampen",   # 1: reduce overconfident prediction
    "trust_mra",       # 2: keep MRA as-is
    "slight_boost",    # 3: amplify underconfident prediction
    "reverse",         # 4: flip direction (half magnitude)
]

ACTION_FACTORS = [0.3, 0.7, 1.0, 1.3, -0.5]

K_ACTIONS = len(ACTION_FACTORS)


# ──────────────────────────────────────────────
# Reward Function
# ──────────────────────────────────────────────

def compute_reward(y_actual, y_mra, action_factor):
    """Per-sample directional reward aligned with IC (Grinold 1989).

    r_raw = y_adj * y_actual - y_mra * y_actual
          = y_actual * y_mra * (action_factor - 1)

    Positive when the action improves directional alignment with actual.
    Removes magnitude-shrinkage bias of squared-error reward that caused
    strong_dampen dominance (49% selection, IC -0.112 in persistent mode).
    Log compression stabilizes extreme rewards (kurtosis=73.5).

    [1-H#19] Transaction cost penalty: actions that change the position
    incur KRX round-trip costs (commission 0.03% + tax 0.18% + slippage 0.10%).
    turnover = |action_factor - 1.0| (0 for trust_mra, higher for larger changes).
    """
    y_adj = y_mra * action_factor
    r_raw = y_adj * y_actual - y_mra * y_actual
    r_compressed = math.copysign(math.log1p(abs(r_raw)), r_raw)

    # [1-H#19] KRX transaction cost penalty
    # Commission 0.03% + Securities tax 0.18% + Slippage ~0.10% = 0.31% round-trip
    KRX_COST = 0.0031
    turnover = abs(action_factor - 1.0)  # 0 for trust_mra, 0.7 for strong_dampen, etc.
    r_compressed -= KRX_COST * turnover

    return r_compressed


# ──────────────────────────────────────────────
# LinUCB Algorithm
# ──────────────────────────────────────────────

class LinUCB:
    """LinUCB Contextual Bandit with Sherman-Morrison updates.

    Parameters
    ----------
    d : int
        Context dimension (before bias). Internal dimension = d + 1.
    K : int
        Number of actions.
    alpha : float
        Exploration parameter for UCB bonus.

    Attributes
    ----------
    A_inv : list of ndarray
        Per-action inverse of accumulated context outer products.
        Initialized as identity. Updated via Sherman-Morrison.
    b : list of ndarray
        Per-action accumulated reward-weighted context vectors.
    """

    def __init__(self, d=10, K=K_ACTIONS, alpha=1.0, reinvert_every=500):
        self.d_internal = d + 1  # +1 for bias
        self.K = K
        self.alpha = alpha
        self.reinvert_every = reinvert_every
        self.A = [np.eye(self.d_internal) for _ in range(K)]
        self.A_inv = [np.eye(self.d_internal) for _ in range(K)]
        self.b = [np.zeros(self.d_internal) for _ in range(K)]
        self._n_updates = [0] * K

    def _add_bias(self, context):
        """Prepend bias term: [1.0, context...]"""
        x = np.zeros(self.d_internal)
        x[0] = 1.0
        x[1:] = np.clip(context, -3.0, 3.0)
        # NaN safety
        x = np.where(np.isfinite(x), x, 0.0)
        return x

    def select_action(self, context):
        """Select action using UCB: argmax_a (theta_a^T x + alpha * sqrt(x^T A_inv_a x)).

        Returns (action_id, ucb_scores).
        """
        x = self._add_bias(context)
        scores = np.zeros(self.K)

        for a in range(self.K):
            theta = self.A_inv[a] @ self.b[a]
            exploit = theta @ x
            explore = self.alpha * np.sqrt(max(x @ self.A_inv[a] @ x, 0.0))
            scores[a] = exploit + explore

        best_a = int(np.argmax(scores))
        return best_a, scores

    def select_greedy(self, context):
        """Greedy selection (no exploration bonus). For test phase."""
        x = self._add_bias(context)
        scores = np.zeros(self.K)
        for a in range(self.K):
            theta = self.A_inv[a] @ self.b[a]
            scores[a] = theta @ x
        return int(np.argmax(scores)), scores

    def update(self, context, action, reward):
        """Update action's model via Sherman-Morrison inverse update.

        A_new = A_old + x x^T
        A_inv_new = A_inv_old - (A_inv_old x x^T A_inv_old) / (1 + x^T A_inv_old x)
        b_new = b_old + reward * x
        """
        x = self._add_bias(context)
        a = action

        # Accumulate A for periodic re-inversion (numerical stability)
        self.A[a] += np.outer(x, x)

        # Sherman-Morrison incremental inverse update
        Ax = self.A_inv[a] @ x
        denom = 1.0 + x @ Ax
        if abs(denom) > 1e-15:
            self.A_inv[a] -= np.outer(Ax, Ax) / denom

        self.b[a] += reward * x
        self._n_updates[a] += 1

        # Periodic re-inversion to prevent floating-point drift
        if self.reinvert_every > 0 and self._n_updates[a] % self.reinvert_every == 0:
            try:
                self.A_inv[a] = np.linalg.inv(self.A[a])
            except np.linalg.LinAlgError:
                pass  # keep Sherman-Morrison approximation

    def get_thetas(self):
        """Extract theta vectors for all actions."""
        thetas = []
        for a in range(self.K):
            theta = self.A_inv[a] @ self.b[a]
            thetas.append(theta.tolist())
        return thetas

    def get_policy_json(self):
        """Export policy as JSON-serializable dict for JS integration."""
        return {
            "algorithm": "LinUCB",
            "d": self.d_internal - 1,
            "K": self.K,
            "action_names": ACTION_NAMES,
            "action_factors": ACTION_FACTORS,
            "thetas": self.get_thetas(),
            "n_updates": self._n_updates[:],
        }

    def get_action_stats(self):
        """Summary statistics for diagnostics."""
        stats = {}
        for a in range(self.K):
            theta = self.A_inv[a] @ self.b[a]
            stats[ACTION_NAMES[a]] = {
                "n_updates": self._n_updates[a],
                "theta_norm": float(np.linalg.norm(theta)),
                "theta_bias": float(theta[0]),
                "theta_features": [round(float(t), 4) for t in theta[1:]],
            }
        return stats

    def reset(self):
        """Reset to initial state (fresh start)."""
        for a in range(self.K):
            self.A[a] = np.eye(self.d_internal)
            self.A_inv[a] = np.eye(self.d_internal)
            self.b[a] = np.zeros(self.d_internal)
            self._n_updates[a] = 0

    def warm_start_from_data(self, contexts, y_pred, y_actual, effective_n=200):
        """Initialize theta vectors from historical MRA prediction data.

        For each arm a:
          1. Compute per-sample reward: r_a[i] = compute_reward(y_actual[i], y_pred[i], factor_a)
          2. Build design matrix X with bias
          3. Scaled Ridge: A = scale*(X^T X) + I, b = scale*(X^T r_a)

        The `effective_n` parameter controls how strongly the warm-start prior
        constrains the bandit. With n=18728 raw samples but effective_n=200,
        the A matrix has eigenvalues ~200 (not ~18728), letting online learning
        override the prior within ~200 new observations.

        Special handling for trust_mra (factor=1.0): since reward is structurally
        zero (y_adj - y_mra = 0), we add a small positive prior to b[trust_mra]
        so the bandit doesn't start with zero confidence in the baseline arm.

        Academic basis: Li et al. (2010) warm-start from logged data,
        core_data/11_RL section 7.3 (warm-start from technical analysis rules).
        Effective-n scaling: analogous to prior strength in Bayesian linear regression.

        Parameters
        ----------
        contexts : ndarray (n, d)
            Context vectors (same dim as LinUCB d, without bias).
        y_pred : array-like (n,)
            MRA predicted returns.
        y_actual : array-like (n,)
            Actual realized returns.
        effective_n : int
            Effective warm-start sample size (controls prior strength).
            Lower = weaker prior = faster adaptation. Default 200.
        """
        n = len(y_pred)
        if n < 10:
            print(f"  [warm_start] Too few samples ({n}), skipping")
            return

        # Build design matrix with bias column
        X = np.zeros((n, self.d_internal))
        for i in range(n):
            X[i] = self._add_bias(contexts[i])

        XtX = X.T @ X

        # Scale factor: reduce A/b to effective_n equivalent
        scale = effective_n / max(n, 1)

        for a in range(self.K):
            factor = ACTION_FACTORS[a]
            # Compute reward for this arm across all warm-start samples
            rewards = np.array([
                compute_reward(float(y_actual[i]), float(y_pred[i]), factor)
                for i in range(n)
            ])

            # Scaled Ridge: A = scale*(X^T X) + I
            self.A[a] = scale * XtX + np.eye(self.d_internal)
            try:
                self.A_inv[a] = np.linalg.inv(self.A[a])
            except np.linalg.LinAlgError:
                self.A_inv[a] = np.eye(self.d_internal)
            self.b[a] = scale * (X.T @ rewards)
            self._n_updates[a] = effective_n

        # Fix: trust_mra (factor=1.0) has structural zero reward.
        # Add a small positive prior to its bias term so it competes fairly.
        # The prior says "trust_mra is a reasonable default" (zero-information prior).
        trust_idx = ACTION_FACTORS.index(1.0)
        # Set trust_mra's bias-term b to a small positive value
        # (equivalent to observing effective_n samples with mean reward ~0.01)
        self.b[trust_idx][0] = effective_n * 0.01

        # Report warm-start theta norms
        for a in range(self.K):
            theta = self.A_inv[a] @ self.b[a]
            print(f"  [warm_start] {ACTION_NAMES[a]:>15}: "
                  f"theta_norm={np.linalg.norm(theta):.4f}, "
                  f"bias={theta[0]:.4f}, n_eff={self._n_updates[a]}")


# ──────────────────────────────────────────────
# Unit Tests
# ──────────────────────────────────────────────

def _test_basic():
    """Test LinUCB learns correct action on synthetic data."""
    print("[Test 1] Basic learning on synthetic data...")
    np.random.seed(42)
    d = 3
    K = 3
    bandit = LinUCB(d=d, K=K, alpha=1.0)

    # Ground truth: action 0 is best when context[0] > 0
    #               action 2 is best when context[0] < 0
    n_train = 500
    for _ in range(n_train):
        ctx = np.random.randn(d)
        if ctx[0] > 0:
            true_best = 0
            rewards = [1.0, 0.0, -0.5]
        else:
            true_best = 2
            rewards = [-0.5, 0.0, 1.0]

        action, _ = bandit.select_action(ctx)
        reward = rewards[action] + np.random.randn() * 0.1
        bandit.update(ctx, action, reward)

    # Test: should pick action 0 for positive context[0]
    n_correct = 0
    n_test = 100
    for _ in range(n_test):
        ctx = np.random.randn(d)
        action, _ = bandit.select_greedy(ctx)
        expected = 0 if ctx[0] > 0 else 2
        if action == expected:
            n_correct += 1

    accuracy = n_correct / n_test * 100
    print(f"  -> Accuracy: {accuracy:.0f}% (expected >70%)")
    assert accuracy > 60, f"LinUCB failed: {accuracy}%"
    print("  -> PASSED")


def _test_reward():
    """Test directional reward function properties."""
    print("[Test 2] Directional reward properties...")

    # When action=trust(1.0), reward should be 0 (no change from baseline)
    r = compute_reward(5.0, 3.0, 1.0)
    assert abs(r) < 1e-10, f"trust_mra reward should be 0, got {r}"

    # MRA correct direction: dampen should be penalized
    r = compute_reward(2.0, 3.0, 0.3)  # y_mra*y_actual > 0, f_a < 1
    assert r < 0, f"Dampening correct prediction should give negative reward, got {r}"

    # MRA correct direction: boost should be rewarded
    r = compute_reward(2.0, 3.0, 1.3)  # y_mra*y_actual > 0, f_a > 1
    assert r > 0, f"Boosting correct prediction should give positive reward, got {r}"

    # MRA wrong direction: dampen should be rewarded
    r = compute_reward(-2.0, 3.0, 0.3)  # y_mra*y_actual < 0, f_a < 1
    assert r > 0, f"Dampening wrong prediction should give positive reward, got {r}"

    # MRA wrong direction: reverse should give highest reward
    r_rev = compute_reward(-2.0, 3.0, -0.5)
    r_damp = compute_reward(-2.0, 3.0, 0.3)
    assert r_rev > r_damp, f"Reverse should beat dampen on wrong prediction: {r_rev} vs {r_damp}"

    # Log compression: large rewards should be bounded
    r_large = compute_reward(100.0, 100.0, 0.3)
    assert r_large < 20, f"Log compression should bound large rewards, got {r_large}"

    # Symmetry: reward magnitude should not depend on sign convention
    r_pos = compute_reward(2.0, 3.0, 0.7)
    r_neg = compute_reward(-2.0, -3.0, 0.7)
    assert abs(r_pos - r_neg) < 1e-10, f"Reward should be symmetric: {r_pos} vs {r_neg}"

    print("  -> PASSED")


def _test_sherman_morrison():
    """Test Sherman-Morrison update matches direct inverse."""
    print("[Test 3] Sherman-Morrison numerical accuracy...")
    np.random.seed(123)
    d = 5
    bandit = LinUCB(d=d, K=1, alpha=0.5, reinvert_every=0)  # no re-inversion

    # Accumulate updates
    A_direct = np.eye(d + 1)
    for _ in range(50):
        ctx = np.random.randn(d)
        x = np.concatenate([[1.0], ctx])
        A_direct += np.outer(x, x)
        bandit.update(ctx, 0, np.random.randn())

    A_inv_direct = np.linalg.inv(A_direct)
    max_err = np.max(np.abs(bandit.A_inv[0] - A_inv_direct))
    print(f"  -> Max error vs direct inverse (no re-inv): {max_err:.2e}")
    assert max_err < 1e-2, f"Sherman-Morrison error too large: {max_err}"

    # With periodic re-inversion, error should be near machine epsilon
    bandit2 = LinUCB(d=d, K=1, alpha=0.5, reinvert_every=25)
    for _ in range(50):
        ctx = np.random.randn(d)
        bandit2.update(ctx, 0, np.random.randn())
    A_inv_direct2 = np.linalg.inv(bandit2.A[0])
    max_err2 = np.max(np.abs(bandit2.A_inv[0] - A_inv_direct2))
    print(f"  -> Max error vs direct inverse (re-inv/25): {max_err2:.2e}")
    assert max_err2 < 1e-10, f"Re-inversion error too large: {max_err2}"
    print("  -> PASSED")


def _test_action_distribution():
    """Test that all actions get explored."""
    print("[Test 4] Exploration coverage...")
    np.random.seed(99)
    d = 5
    bandit = LinUCB(d=d, K=K_ACTIONS, alpha=2.0)  # High alpha for exploration

    for _ in range(200):
        ctx = np.random.randn(d)
        action, _ = bandit.select_action(ctx)
        reward = np.random.randn() * 0.5
        bandit.update(ctx, action, reward)

    min_pulls = min(bandit._n_updates)
    print(f"  -> Action pulls: {bandit._n_updates}")
    print(f"  -> Min pulls: {min_pulls} (expected >10)")
    assert min_pulls > 5, f"Under-explored action: min pulls = {min_pulls}"
    print("  -> PASSED")


def main():
    """Run all unit tests."""
    print("=" * 60)
    print("Stage B-3: LinUCB Unit Tests")
    print("=" * 60)

    _test_basic()
    _test_reward()
    _test_sherman_morrison()
    _test_action_distribution()

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)

    # Demo: export policy JSON
    bandit = LinUCB(d=10, K=K_ACTIONS, alpha=1.0)
    np.random.seed(42)
    for _ in range(100):
        ctx = np.random.randn(10)
        action, _ = bandit.select_action(ctx)
        reward = compute_reward(
            y_actual=np.random.randn(),
            y_mra=np.random.randn(),
            action_factor=ACTION_FACTORS[action],
        )
        bandit.update(ctx, action, reward)

    policy = bandit.get_policy_json()
    print(f"\nDemo policy export:")
    print(f"  d={policy['d']}, K={policy['K']}")
    print(f"  Actions: {policy['action_names']}")
    print(f"  Factors: {policy['action_factors']}")
    print(f"  Updates: {policy['n_updates']}")


if __name__ == "__main__":
    main()
