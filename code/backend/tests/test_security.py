from app.security import hash_password, new_session_token, token_digest, verify_password


def test_right_password_verifies():
    assert verify_password("campus123", hash_password("campus123"))


def test_wrong_password_fails():
    assert not verify_password("campus124", hash_password("campus123"))


def test_same_password_hashes_differently_each_time():
    assert hash_password("campus123") != hash_password("campus123")


def test_malformed_stored_hash_fails_safely():
    assert not verify_password("x", "not-a-hash")


def test_tokens_are_random_and_stored_only_as_digest():
    a, b = new_session_token(), new_session_token()
    assert a != b
    assert token_digest(a) != a and len(token_digest(a)) == 64
