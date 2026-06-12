"""
Remote Desktop Manager - Python版
Windows运维远程桌面管理工具
"""
import sys
from pathlib import Path

# 添加src到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.main_window import run_app

if __name__ == "__main__":
    run_app()
