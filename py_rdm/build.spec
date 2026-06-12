# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置文件
Windows运维远程桌面管理工具
"""
import os
from pathlib import Path

# 项目根目录
project_root = Path(os.getcwd())
src_dir = project_root / "src"
icon_path = project_root.parent / "resources" / "icon.ico"

# 收集所有源文件
datas = [
    (str(src_dir), "src"),  # 复制整个 src 目录
]

# 隐式导入 - 添加 pywin32 相关模块
hiddenimports = [
    "PyQt6.QtCore",
    "PyQt6.QtGui",
    "PyQt6.QtWidgets",
    "cryptography.hazmat.primitives.ciphers.aead",
    "cryptography.hazmat.primitives.kdf.pbkdf2",
    "cryptography.hazmat.primitives.hashes",
    "win32crypt",
    "win32api",
    "win32con",
    "pywintypes",
]

a = Analysis(
    ["main.py"],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "scipy",
        "PIL",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Windows运维远程桌面管理工具",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # 不显示控制台窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_path) if icon_path.exists() else None,
    version_file=None,
)