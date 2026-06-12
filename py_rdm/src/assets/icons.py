"""
堡垒机/VPN 图标 - 使用 SVG 路径绘制的矢量图标
每个图标都是一个函数，返回 SVG 路径字符串
"""

# 通用 VPN 盾牌图标
def vpn_shield(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="{color}" opacity="0.2"/>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>'''

# 网络/连接图标
def network_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="5" r="3" fill="{color}" opacity="0.3"/>
        <circle cx="5" cy="19" r="3" fill="{color}" opacity="0.3"/>
        <circle cx="19" cy="19" r="3" fill="{color}" opacity="0.3"/>
        <path d="M12 8v3M7 17l3-3M17 17l-3-3" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="2" fill="{color}"/>
    </svg>'''

# 锁/安全图标
def lock_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="{color}" opacity="0.2"/>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="{color}" stroke-width="2"/>
        <path d="M8 11V7a4 4 0 018 0v4" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
    </svg>'''

# 电脑/客户端图标
def computer_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="12" rx="2" fill="{color}" opacity="0.2"/>
        <rect x="3" y="4" width="18" height="12" rx="2" stroke="{color}" stroke-width="2"/>
        <path d="M8 20h8M12 16v4" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
    </svg>'''

# 云图标
def cloud_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" fill="{color}" opacity="0.2"/>
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>'''

# 防火墙图标
def firewall_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="16" height="16" rx="2" fill="{color}" opacity="0.2"/>
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="{color}" stroke-width="2"/>
        <path d="M8 12h8M12 8v8" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
    </svg>'''

# 路由器图标
def router_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="14" width="16" height="6" rx="2" fill="{color}" opacity="0.2"/>
        <rect x="4" y="14" width="16" height="6" rx="2" stroke="{color}" stroke-width="2"/>
        <path d="M8 14v-2a4 4 0 018 0v2" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="8" cy="17" r="1" fill="{color}"/>
        <circle cx="16" cy="17" r="1" fill="{color}"/>
    </svg>'''

# 地球/全球图标
def globe_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="{color}" opacity="0.2"/>
        <circle cx="12" cy="12" r="10" stroke="{color}" stroke-width="2"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="{color}" stroke-width="2"/>
    </svg>'''

# SSL 证书图标
def ssl_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="8" width="16" height="12" rx="2" fill="{color}" opacity="0.2"/>
        <rect x="4" y="8" width="16" height="12" rx="2" stroke="{color}" stroke-width="2"/>
        <path d="M8 8V6a4 4 0 018 0v2" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M9 14l2 2 4-4" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>'''

# 钥匙/认证图标
def key_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="15" r="4" fill="{color}" opacity="0.2"/>
        <circle cx="8" cy="15" r="4" stroke="{color}" stroke-width="2"/>
        <path d="M12 11l6-6M18 5l2 2M15 8l2 2" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>'''

# 自定义/其他图标
def custom_icon(color: str = "#2563eb") -> str:
    return f'''<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="{color}" opacity="0.2"/>
        <circle cx="12" cy="12" r="10" stroke="{color}" stroke-width="2"/>
        <path d="M12 8v8M8 12h8" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
    </svg>'''


# 堡垒机选项与图标的映射
BASTION_ICONS = {
    "v5vpn": lambda c: vpn_shield(c),
    "inode": lambda c: computer_icon(c),
    "easyconnect": lambda c: cloud_icon(c),
    "opsclient": lambda c: computer_icon(c),
    "secoclient": lambda c: firewall_icon(c),
    "rgsslvpn": lambda c: ssl_icon(c),
    "tgfw": lambda c: firewall_icon(c),
    "atrust": lambda c: lock_icon(c),
    "sslvpn": lambda c: ssl_icon(c),
    "hillstone": lambda c: router_icon(c),
    "custom": lambda c: custom_icon(c),
}


def get_bastion_icon(key: str, color: str = "#2563eb") -> str:
    """获取堡垒机图标 SVG 字符串"""
    icon_fn = BASTION_ICONS.get(key, BASTION_ICONS["custom"])
    return icon_fn(color)
