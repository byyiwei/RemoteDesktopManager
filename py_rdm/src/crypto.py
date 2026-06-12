"""
密码加密模块
1. Windows DPAPI 加密：本机绑定，用于本地存储
2. AES-256-GCM + PBKDF2：口令绑定，用于导入/导出（可跨机器）
"""
import base64
import os
import platform
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


# ======================== Windows DPAPI 加密 ========================

def _import_dpapi():
    """导入Windows DPAPI模块"""
    if platform.system() != "Windows":
        return None
    try:
        import win32crypt
        return win32crypt
    except ImportError:
        return None


def is_dpapi_available() -> bool:
    """检查DPAPI是否可用"""
    return _import_dpapi() is not None


def encrypt_password_dpapi(plaintext: str) -> str:
    """使用Windows DPAPI加密密码"""
    if not plaintext:
        return ""
    win32crypt = _import_dpapi()
    if win32crypt is None:
        raise RuntimeError("Windows DPAPI 不可用")
    data = plaintext.encode("utf-8")
    encrypted = win32crypt.CryptProtectData(data, "RDM_Password")
    return base64.b64encode(encrypted).decode("ascii")


def decrypt_password_dpapi(encrypted_b64: str) -> str:
    """使用Windows DPAPI解密密码"""
    if not encrypted_b64:
        return ""
    win32crypt = _import_dpapi()
    if win32crypt is None:
        raise RuntimeError("Windows DPAPI 不可用")
    encrypted = base64.b64decode(encrypted_b64)
    _, data = win32crypt.CryptUnprotectData(encrypted)
    return data.decode("utf-8")


# ======================== 可移植加密（导入/导出用） ========================

def portable_encrypt(plaintext: str, passphrase: str) -> str:
    """使用AES-256-GCM + PBKDF2加密（可跨机器）"""
    if not plaintext:
        return ""
    salt = os.urandom(32)
    iv = os.urandom(12)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = kdf.derive(passphrase.encode("utf-8"))

    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)

    # salt(32) + iv(12) + ciphertext
    combined = salt + iv + ciphertext
    return base64.b64encode(combined).decode("ascii")


def portable_decrypt(encrypted_b64: str, passphrase: str) -> str:
    """解密可移植加密的数据"""
    if not encrypted_b64:
        return ""
    data = base64.b64decode(encrypted_b64)

    salt = data[:32]
    iv = data[32:44]
    ciphertext = data[44:]

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = kdf.derive(passphrase.encode("utf-8"))

    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode("utf-8")
