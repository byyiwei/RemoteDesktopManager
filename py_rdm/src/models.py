"""
数据模型定义
"""
from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime
import uuid


@dataclass
class Connection:
    """连接数据模型"""
    client_name: str
    ip_address: str
    port: int = 3389
    username: str = ""
    encrypted_password: str = ""
    bastion_hosts: List[str] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Connection":
        return cls(**data)

    @property
    def has_password(self) -> bool:
        return bool(self.encrypted_password)

    @property
    def display_name(self) -> str:
        return f"{self.client_name} ({self.ip_address}:{self.port})"


# 预置堡垒机/VPN选项
BASTION_HOST_OPTIONS = [
    {"key": "v5vpn", "label": "V5VPN", "color": "#16a34a"},
    {"key": "inode", "label": "iNode智能客户端", "color": "#2563eb"},
    {"key": "easyconnect", "label": "EasyConnect", "color": "#0d9488"},
    {"key": "opsclient", "label": "运维客户端", "color": "#0891b2"},
    {"key": "secoclient", "label": "SecoClient", "color": "#dc2626"},
    {"key": "rgsslvpn", "label": "RgSSL VPN", "color": "#1e3a5f"},
    {"key": "tgfw", "label": "tgfw", "color": "#b91c1c"},
    {"key": "atrust", "label": "aTrust", "color": "#059669"},
    {"key": "sslvpn", "label": "SSLVPN Client", "color": "#1d4ed8"},
    {"key": "hillstone", "label": "Hillstone", "color": "#1e40af"},
]
