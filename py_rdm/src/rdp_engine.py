"""
RDP 远程桌面连接引擎
"""
import re
import os
import uuid
import tempfile
import subprocess
from pathlib import Path
from typing import Optional


IP_REGEX = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")


def validate_ip(ip: str) -> bool:
    """验证IPv4地址"""
    match = IP_REGEX.match(ip)
    if not match:
        return False
    return all(0 <= int(octet) <= 255 for octet in match.groups())


def validate_port(port: int) -> bool:
    """验证端口号"""
    return isinstance(port, int) and 1 <= port <= 65535


def generate_rdp_file(ip: str, port: int, username: str) -> str:
    """生成.rdp配置文件内容"""
    lines = [
        f"full address:s:{ip}:{port}",
        f"username:s:{username}",
        "domain:s:.",
        "prompt for credentials:i:0",
        "promptcredentialonce:i:0",
        "enablecredsspsupport:i:1",
        "authentication level:i:2",
        "negotiate security layer:i:1",
        "disable wallpaper:i:0",
        "disable full window drag:i:1",
        "disable menu anims:i:1",
        "disable themes:i:0",
        "disable cursor setting:i:0",
        "bitmapcachepersistenable:i:1",
        "audiomode:i:0",
        "redirectprinters:i:0",
        "redirectcomports:i:0",
        "redirectsmartcards:i:0",
        "redirectclipboard:i:1",
        "redirectdrives:i:0",
        "keyboardhook:i:2",
        "displayconnectionbar:i:1",
        "autoreconnection enabled:i:1",
        "compression:i:1",
        "audiocapturemode:i:0",
        "videoplaybackmode:i:1",
        "connection type:i:2",
        "networkautodetect:i:1",
        "bandwidthautodetect:i:1",
        "screen mode id:i:2",
        "smart sizing:i:1",
        "desktopwidth:i:1280",
        "desktopheight:i:720",
        "session bpp:i:32",
        "winposstr:s:0,3,0,0,800,600",
    ]
    return "\r\n".join(lines)


def start_rdp_connection(ip: str, port: int, username: str, password: str) -> subprocess.Popen:
    """
    启动RDP连接
    返回mstsc进程对象，调用方负责监控和清理
    """
    if not validate_ip(ip):
        raise ValueError(f"无效的IP地址: {ip}")
    if not validate_port(port):
        raise ValueError(f"无效的端口号: {port}")
    if not username or not username.strip():
        raise ValueError("用户名不能为空")
    if not password:
        raise ValueError("密码不能为空")

    # 构建所有可能的目标名格式（兼容不同服务器的 mstsc 查找方式）
    targets = [f"TERMSRV/{ip}", f"TERMSRV/{ip}:{port}"]
    targets = list(set(targets))  # 去重

    import time

    # 1. 清除所有目标的旧凭据
    for t in targets:
        try:
            subprocess.run(["cmdkey", f"/delete:{t}"], capture_output=True, timeout=5)
        except Exception:
            pass
    time.sleep(0.2)

    # cmdkey 必须使用纯用户名，不能带 .\ 前缀（否则 cmdkey 命令会执行失败）

    # 2. 为所有目标注入新凭据
    for t in targets:
        try:
            subprocess.run(
                ["cmdkey", f"/add:{t}", f"/user:{username}", f"/pass:{password}"],
                check=True,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except Exception as e:
            print(f"[RDP] 写入凭据失败: {t}, {e}")

    # 3. 验证凭据已注入
    try:
        verify_result = subprocess.run(
            ["cmdkey", "/list"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        found = any(t.lower() in verify_result.stdout.lower() for t in targets)
        if not found:
            print(f"[RDP] 警告：所有目标的凭据均未在列表中找到")
    except Exception:
        pass

    # 3. 生成临时.rdp文件
    rdp_content = generate_rdp_file(ip, port, username)
    rdp_path = Path(tempfile.gettempdir()) / f"rdm_{uuid.uuid4().hex}.rdp"
    rdp_path.write_text(rdp_content, encoding="utf-8")

    # 4. 启动mstsc
    proc = subprocess.Popen(
        ["mstsc", str(rdp_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # 存储清理信息到进程对象
    proc._rdm_targets = targets
    proc._rdm_rdp_path = rdp_path

    return proc


def cleanup_rdp(proc: subprocess.Popen):
    """清理RDP连接产生的凭据和临时文件"""
    # 清除所有目标的凭据
    targets = getattr(proc, "_rdm_targets", [])
    for target in targets:
        try:
            subprocess.run(["cmdkey", f"/delete:{target}"], capture_output=True)
        except Exception:
            pass

    # 删除临时文件
    rdp_path = getattr(proc, "_rdm_rdp_path", None)
    if rdp_path and rdp_path.exists():
        try:
            rdp_path.unlink()
        except Exception:
            pass
