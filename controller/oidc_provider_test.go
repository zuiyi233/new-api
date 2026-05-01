package controller

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveOIDCTokenByHintFallsBackFromWrongHint(t *testing.T) {
	access := &model.OIDCToken{ClientID: "c1", Subject: "u1"}

	accessCalls := 0
	refreshCalls := 0
	token, tokenType := resolveOIDCTokenByHint(
		"refresh_token",
		func() (*model.OIDCToken, error) {
			accessCalls++
			return access, nil
		},
		func() (*model.OIDCToken, error) {
			refreshCalls++
			return nil, errors.New("not found")
		},
	)

	if token == nil {
		t.Fatalf("expected token, got nil")
	}
	if tokenType != "Bearer" {
		t.Fatalf("expected Bearer, got %s", tokenType)
	}
	if refreshCalls != 1 {
		t.Fatalf("expected refresh lookup first once, got %d", refreshCalls)
	}
	if accessCalls != 1 {
		t.Fatalf("expected access fallback once, got %d", accessCalls)
	}
}

func TestResolveOIDCTokenByHintAccessHintFallsBackToRefresh(t *testing.T) {
	refresh := &model.OIDCToken{ClientID: "c2", Subject: "u2"}

	accessCalls := 0
	refreshCalls := 0
	token, tokenType := resolveOIDCTokenByHint(
		"access_token",
		func() (*model.OIDCToken, error) {
			accessCalls++
			return nil, errors.New("not found")
		},
		func() (*model.OIDCToken, error) {
			refreshCalls++
			return refresh, nil
		},
	)

	if token == nil {
		t.Fatalf("expected token, got nil")
	}
	if tokenType != "refresh_token" {
		t.Fatalf("expected refresh_token, got %s", tokenType)
	}
	if accessCalls != 1 {
		t.Fatalf("expected access lookup once, got %d", accessCalls)
	}
	if refreshCalls != 1 {
		t.Fatalf("expected refresh fallback once, got %d", refreshCalls)
	}
}

func TestResolveRefreshTokenScopeUsesIntersectionAndSupportsConvergence(t *testing.T) {
	scope, err := resolveRefreshTokenScope("", `["openid","profile"]`, "openid profile email")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if scope != "openid profile" {
		t.Fatalf("expected converged scope 'openid profile', got %q", scope)
	}
}

func TestResolveRefreshTokenScopeRejectsEscalation(t *testing.T) {
	_, err := resolveRefreshTokenScope("openid email", `["openid","profile"]`, "openid profile")
	if err == nil {
		t.Fatalf("expected invalid scope error, got nil")
	}
}
