"""
PMO Platform — JWT Authentication Module
=========================================
This module contains ONE function: get_current_user().
It is used as a FastAPI dependency by any route that needs authentication.

How it works:
1. Extracts the Bearer token from the Authorization header
2. Decodes it locally using the SUPABASE_JWT_SECRET (no call to Supabase)
3. Validates the signature (was this token created by someone with the secret?)
4. Checks expiration (is this token still valid?)
5. Returns the decoded payload (sub, role, exp) to the calling route

If any step fails → raises HTTPException (401 or 403).
The route function NEVER executes if auth fails.
"""

import os
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# HTTPBearer extracts "Bearer <token>" from the Authorization header automatically.
# If the header is missing or malformed, FastAPI returns 403 before our code runs.
security = HTTPBearer()

# The shared secret. Supabase signs tokens with this at login.
# FastAPI recomputes the signature with this to validate.
# Stored as Railway env var — never in code.
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> dict:
    """
    FastAPI dependency that validates a Supabase JWT.

    Usage in any route:
        @router.post("/my-endpoint")
        async def my_endpoint(user: dict = Depends(get_current_user)):
            # 'user' contains the decoded JWT payload
            # This line only runs if the token is valid

    Returns:
        dict with keys: sub (user ID), role, exp, and other Supabase claims

    Raises:
        HTTPException 401: token is invalid, expired, or missing
    """
    token = credentials.credentials

    if not JWT_SECRET:
        # Fail loudly if the secret is not configured.
        # This should never happen in production — it means Railway env vars are wrong.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET not configured. Check Railway environment variables.",
        )

    try:
        # THIS IS THE LINE. The entire JWT comprehension gate lives here.
        # jwt.decode() does three things:
        #   1. Splits token into header.payload.signature
        #   2. Recomputes HMAC-SHA256(header + payload, JWT_SECRET)
        #   3. Compares recomputed signature to embedded signature
        # If they match → token is authentic. If not → InvalidSignatureError.
        # It also checks 'exp' automatically → ExpiredSignatureError if past.
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase JWTs use 'authenticated' audience
        )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        # Catches: InvalidSignatureError, DecodeError, and any other JWT issue.
        # We don't reveal specifics to the caller — that would help an attacker.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(required_role: str):
    """
    Returns a dependency that checks the user's role claim.

    Usage:
        @router.post("/briefing")
        async def briefing(user: dict = Depends(require_role("ml_admin"))):
            # Only ml_admin users reach this line

    This is a dependency factory — it returns a NEW dependency function
    that first calls get_current_user(), then checks the role.
    """

    async def role_checker(
        user: Annotated[dict, Depends(get_current_user)],
    ) -> dict:
        user_role = user.get("role", "")
        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires '{required_role}' role. Your role: '{user_role}'.",
            )
        return user

    return role_checker
