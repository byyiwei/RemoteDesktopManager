"""
主窗口 - 现代化设计
"""
import sys
from pathlib import Path
from typing import Optional, List

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QScrollArea, QFrame, QGridLayout,
    QDialog, QFormLayout, QSpinBox, QCheckBox,
    QFileDialog, QMenu, QGraphicsDropShadowEffect, QToolButton,
)
from PyQt6.QtCore import Qt, QSize, QPoint, QTimer, pyqtSignal, QPropertyAnimation
from PyQt6.QtGui import QFont, QCursor, QColor, QPalette, QLinearGradient, QBrush, QIcon, QKeyEvent

from .models import Connection, BASTION_HOST_OPTIONS
from .store import ConnectionStore
from .crypto import (
    encrypt_password_dpapi, decrypt_password_dpapi,
    portable_encrypt, portable_decrypt, is_dpapi_available
)
from .rdp_engine import start_rdp_connection, cleanup_rdp, validate_ip
from .themes import theme_manager, ThemeMode
from .dialogs import show_message, show_question, show_input


# ======================== 自定义图标 ========================
class Icons:
    """Unicode 图标常量"""
    SEARCH = "🔍"
    ADD = "➕"
    EDIT = "✏️"
    DELETE = "🗑️"
    CONNECT = "🔗"
    EYE = "👁️"
    EXPORT = "📤"
    IMPORT = "📥"
    THEME = "🎨"
    SUN = "☀️"
    MOON = "🌙"
    SYSTEM = "🖥️"
    LOCK = "🔒"
    UNLOCK = "🔓"
    USER = "👤"
    IP = "🌐"
    CLOSE = "✕"
    MINIMIZE = "—"
    MAXIMIZE = "□"
    RESTORE = "❐"
    SERVER = "🖥️"
    NETWORK = "🌐"
    SHIELD = "🛡️"


# ======================== 自定义搜索输入框 ========================
class SearchLineEdit(QLineEdit):
    """支持上下键和回车的搜索输入框"""
    navigate_up = pyqtSignal()
    navigate_down = pyqtSignal()
    activate_selected = pyqtSignal()

    def keyPressEvent(self, event: QKeyEvent):
        key = event.key()
        if key == Qt.Key.Key_Up:
            self.navigate_up.emit()
        elif key == Qt.Key.Key_Down:
            self.navigate_down.emit()
        elif key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
            self.activate_selected.emit()
        else:
            super().keyPressEvent(event)


# ======================== 连接卡片 ========================
class ConnectionCard(QFrame):
    connect_clicked = pyqtSignal(str)
    edit_clicked = pyqtSignal(str)
    delete_clicked = pyqtSignal(str)
    view_password_clicked = pyqtSignal(str)

    def __init__(self, connection: Connection, parent=None):
        super().__init__(parent)
        self.connection = connection
        self._setup_ui()
        self._apply_theme()
        theme_manager.add_listener(self._on_theme_changed)

    def _setup_ui(self):
        self.setObjectName("connectionCard")
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.setMinimumWidth(320)
        self.setFixedHeight(200)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        # 头部：状态条 + 名称 + 操作按钮
        header = QHBoxLayout()
        header.setSpacing(12)

        # 状态指示条
        status_bar = QFrame()
        status_bar.setFixedWidth(4)
        status_bar.setFixedHeight(40)
        status_bar.setObjectName("statusBar")
        if self.connection.bastion_hosts:
            opt = next((o for o in BASTION_HOST_OPTIONS if o["key"] == self.connection.bastion_hosts[0]), None)
            if opt:
                status_bar.setStyleSheet(f"background: {opt['color']}; border-radius: 2px;")
        else:
            status_bar.setStyleSheet("background: #64748b; border-radius: 2px;")
        header.addWidget(status_bar)

        # 名称和描述
        name_box = QVBoxLayout()
        name_box.setSpacing(4)
        self.name_label = QLabel(self.connection.client_name)
        self.name_label.setObjectName("cardName")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        self.name_label.setFont(font)
        name_box.addWidget(self.name_label)

        # IP:端口
        self.ip_label = QLabel(f"{Icons.IP} {self.connection.ip_address}:{self.connection.port}")
        self.ip_label.setObjectName("cardInfo")
        name_box.addWidget(self.ip_label)
        header.addLayout(name_box, 1)

        # 操作按钮组
        actions = QHBoxLayout()
        actions.setSpacing(6)

        self.view_pwd_btn = QToolButton()
        self.view_pwd_btn.setObjectName("actionBtn")
        self.view_pwd_btn.setFixedSize(32, 32)
        self.view_pwd_btn.setToolTip("查看密码")
        self.view_pwd_btn.clicked.connect(lambda: self.view_password_clicked.emit(self.connection.id))
        actions.addWidget(self.view_pwd_btn)

        self.edit_btn = QToolButton()
        self.edit_btn.setObjectName("actionBtn")
        self.edit_btn.setFixedSize(32, 32)
        self.edit_btn.setToolTip("编辑")
        self.edit_btn.clicked.connect(lambda: self.edit_clicked.emit(self.connection.id))
        actions.addWidget(self.edit_btn)

        self.del_btn = QToolButton()
        self.del_btn.setObjectName("actionBtnDelete")
        self.del_btn.setFixedSize(32, 32)
        self.del_btn.setToolTip("删除")
        self.del_btn.clicked.connect(lambda: self.delete_clicked.emit(self.connection.id))
        actions.addWidget(self.del_btn)

        header.addLayout(actions)
        layout.addLayout(header)

        # 分隔线
        sep = QFrame()
        sep.setObjectName("sepLine")
        sep.setFixedHeight(1)
        layout.addWidget(sep)

        # 详细信息
        info_layout = QGridLayout()
        info_layout.setSpacing(10)
        info_layout.setColumnStretch(0, 1)
        info_layout.setColumnStretch(1, 1)

        # 用户名
        user_row = QHBoxLayout()
        user_row.setSpacing(6)
        user_icon = QLabel(Icons.USER)
        user_icon.setObjectName("infoIcon")
        self.user_label = QLabel(self.connection.username)
        self.user_label.setObjectName("infoText")
        user_row.addWidget(user_icon)
        user_row.addWidget(self.user_label)
        user_row.addStretch()
        info_layout.addLayout(user_row, 0, 0)

        # 密码状态
        pwd_row = QHBoxLayout()
        pwd_row.setSpacing(6)
        if self.connection.has_password:
            pwd_icon = QLabel(Icons.LOCK)
            pwd_icon.setObjectName("infoIcon")
            self.pwd_status = QLabel("已加密")
            self.pwd_status.setObjectName("infoTextSuccess")
        else:
            pwd_icon = QLabel(Icons.UNLOCK)
            pwd_icon.setObjectName("infoIconWarning")
            self.pwd_status = QLabel("未设置")
            self.pwd_status.setObjectName("infoTextWarning")
        pwd_row.addWidget(pwd_icon)
        pwd_row.addWidget(self.pwd_status)
        pwd_row.addStretch()
        info_layout.addLayout(pwd_row, 0, 1)

        # 堡垒机标签
        if self.connection.bastion_hosts:
            bastion_row = QHBoxLayout()
            bastion_row.setSpacing(8)
            bastion_icon = QLabel(Icons.SHIELD)
            bastion_icon.setObjectName("infoIcon")
            bastion_row.addWidget(bastion_icon)
            
            tags_layout = QHBoxLayout()
            tags_layout.setSpacing(6)
            for key in self.connection.bastion_hosts[:2]:
                opt = next((o for o in BASTION_HOST_OPTIONS if o["key"] == key), None)
                if opt:
                    tag = QLabel(opt["label"])
                    tag.setObjectName("bastionTag")
                    tag.setStyleSheet(f"""
                        QLabel#bastionTag {{
                            background: {opt['color']}20;
                            color: {opt['color']};
                            border: 1px solid {opt['color']}40;
                            border-radius: 16px;
                            padding: 4px 10px;
                            font-size: 11px;
                            font-weight: 500;
                        }}
                    """)
                    tags_layout.addWidget(tag)
            bastion_row.addLayout(tags_layout)
            bastion_row.addStretch()
            info_layout.addLayout(bastion_row, 1, 0, 1, 2)

        layout.addLayout(info_layout)

        # 底部：时间 + 连接按钮
        footer = QHBoxLayout()
        footer.setSpacing(12)
        
        self.time_label = QLabel(f"更新于 {self._fmt_time(self.connection.updated_at)}")
        self.time_label.setObjectName("cardTime")
        footer.addWidget(self.time_label)
        footer.addStretch()

        self.connect_btn = QPushButton(f"{Icons.CONNECT} 连接")
        self.connect_btn.setObjectName("connectBtn")
        self.connect_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.connect_btn.setFixedHeight(36)
        self.connect_btn.setMinimumWidth(100)
        self.connect_btn.clicked.connect(lambda: self.connect_clicked.emit(self.connection.id))
        footer.addWidget(self.connect_btn)
        layout.addLayout(footer)

        # 阴影效果
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(20)
        shadow.setColor(QColor(0, 0, 0, 30))
        shadow.setOffset(0, 8)
        self.setGraphicsEffect(shadow)

    def _apply_theme(self):
        c = theme_manager.colors
        self.setStyleSheet(f"""
            QFrame#connectionCard {{
                background: {c['bg_white']};
                border: 1px solid {c['border']};
                border-radius: 16px;
            }}
            QFrame#connectionCard:hover {{
                border-color: {c['card_hover_border']};
            }}
            QFrame#sepLine {{
                background: {c['border_light']};
            }}
            QLabel#cardName {{
                color: {c['text']};
            }}
            QLabel#cardInfo {{
                color: {c['text_secondary']};
                font-size: 13px;
                font-family: "SF Mono", "Consolas", monospace;
            }}
            QLabel#infoIcon {{
                color: {c['text_muted']};
                font-size: 14px;
            }}
            QLabel#infoIconWarning {{
                color: {c['warning']};
                font-size: 14px;
            }}
            QLabel#infoText {{
                color: {c['text_secondary']};
                font-size: 13px;
            }}
            QLabel#infoTextSuccess {{
                color: {c['success']};
                font-size: 13px;
            }}
            QLabel#infoTextWarning {{
                color: {c['warning']};
                font-size: 13px;
            }}
            QLabel#cardTime {{
                color: {c['text_muted']};
                font-size: 12px;
            }}
            QPushButton#connectBtn {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 {c['primary']}, stop:1 {c['primary_light']});
                color: white;
                border: none;
                border-radius: 10px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: 600;
            }}
            QPushButton#connectBtn:hover {{
                background: {c['primary_light']};
            }}
            QToolButton#actionBtn {{
                background: {c['bg']};
                color: {c['text_muted']};
                border: none;
                border-radius: 8px;
                font-size: 14px;
            }}
            QToolButton#actionBtn:hover {{
                background: {c['btn_hover']};
                color: {c['text']};
            }}
            QToolButton#actionBtnDelete {{
                background: {c['bg']};
                color: {c['text_muted']};
                border: none;
                border-radius: 8px;
                font-size: 14px;
            }}
            QToolButton#actionBtnDelete:hover {{
                background: {c['danger_bg']};
                color: {c['danger']};
            }}
        """)

    def _on_theme_changed(self, colors: dict):
        self._apply_theme()

    def _fmt_time(self, iso: str) -> str:
        from datetime import datetime
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            return dt.strftime("%m-%d %H:%M")
        except Exception:
            return iso

    def mouseDoubleClickEvent(self, event):
        self.connect_clicked.emit(self.connection.id)


# ======================== 连接表单对话框 ========================
class ConnectionDialog(QDialog):
    def __init__(self, connection: Optional[Connection] = None, parent=None):
        super().__init__(parent)
        self.connection = connection
        self.setWindowTitle("编辑连接" if connection else "新建连接")
        self.setMinimumWidth(480)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self._setup_ui()
        self._apply_theme()
        theme_manager.add_listener(self._on_theme_changed)

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(0, 0, 0, 0)

        # 自定义标题栏
        title_bar = QFrame()
        title_bar.setFixedHeight(48)
        title_bar.setObjectName("dialogTitleBar")
        title_layout = QHBoxLayout(title_bar)
        title_layout.setContentsMargins(24, 0, 0, 0)
        title_layout.setSpacing(12)

        title = QLabel("编辑连接" if self.connection else "新建连接")
        title.setObjectName("dialogTitle")
        font = QFont()
        font.setPointSize(15)
        font.setBold(True)
        title.setFont(font)
        title_layout.addWidget(title)
        title_layout.addStretch()

        close_btn = QToolButton()
        close_btn.setFixedSize(36, 36)
        close_btn.setObjectName("dialogCloseBtn")
        close_btn.clicked.connect(self.reject)
        title_layout.addWidget(close_btn)
        layout.addWidget(title_bar)

        # 内容区
        content = QWidget()
        content.setObjectName("dialogContent")
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(20)
        content_layout.setContentsMargins(24, 20, 24, 24)

        # 副标题
        subtitle = QLabel("填写远程桌面连接信息")
        subtitle.setObjectName("dialogSubtitle")
        content_layout.addWidget(subtitle)

        form = QFormLayout()
        form.setSpacing(16)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignLeft)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("如：公司服务器、数据库主机")
        self.name_input.setObjectName("formInput")
        form.addRow("连接名称", self.name_input)

        self.ip_input = QLineEdit()
        self.ip_input.setPlaceholderText("192.168.1.100")
        self.ip_input.setObjectName("formInput")
        form.addRow("IP 地址", self.ip_input)

        port_user = QHBoxLayout()
        port_user.setSpacing(12)
        self.port_input = QSpinBox()
        self.port_input.setRange(1, 65535)
        self.port_input.setValue(3389)
        self.port_input.setFixedWidth(120)
        self.port_input.setObjectName("formInput")
        port_user.addWidget(self.port_input)

        self.user_input = QLineEdit()
        self.user_input.setPlaceholderText("Administrator")
        self.user_input.setObjectName("formInput")
        port_user.addWidget(self.user_input, 1)
        form.addRow("端口 / 用户名", port_user)

        self.pwd_input = QLineEdit()
        self.pwd_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.pwd_input.setPlaceholderText(
            "留空则不修改密码" if self.connection else "输入远程桌面密码"
        )
        self.pwd_input.setObjectName("formInput")
        form.addRow("密码", self.pwd_input)

        # 堡垒机多选
        bastion_label = QLabel("堡垒机 / VPN")
        bastion_label.setObjectName("formLabel")
        form.addRow(bastion_label, QLabel())
        
        self.bastion_checks = {}
        bastion_grid = QGridLayout()
        bastion_grid.setSpacing(10)
        for i, opt in enumerate(BASTION_HOST_OPTIONS):
            cb = QCheckBox(opt["label"])
            cb.setObjectName("formCheckbox")
            self.bastion_checks[opt["key"]] = cb
            bastion_grid.addWidget(cb, i // 2, i % 2)
        form.addRow(bastion_grid)

        content_layout.addLayout(form)
        content_layout.addSpacing(8)

        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setObjectName("secondaryBtn")
        self.cancel_btn.setFixedHeight(40)
        self.cancel_btn.setMinimumWidth(80)
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)

        self.save_btn = QPushButton("保存")
        self.save_btn.setObjectName("primaryBtn")
        self.save_btn.setFixedHeight(40)
        self.save_btn.setMinimumWidth(80)
        self.save_btn.clicked.connect(self._on_save)
        btn_layout.addWidget(self.save_btn)
        content_layout.addLayout(btn_layout)

        layout.addWidget(content)

        # 预填充数据
        if self.connection:
            self.name_input.setText(self.connection.client_name)
            self.ip_input.setText(self.connection.ip_address)
            self.port_input.setValue(self.connection.port)
            self.user_input.setText(self.connection.username)
            for key in self.connection.bastion_hosts:
                if key in self.bastion_checks:
                    self.bastion_checks[key].setChecked(True)

    def _apply_theme(self):
        c = theme_manager.colors
        self.setStyleSheet(f"""
            QDialog {{
                background: {c['bg_white']};
                border: 1px solid {c['border']};
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            }}
            QFrame#dialogTitleBar {{
                background: {c['titlebar_bg']};
                border-bottom: 1px solid {c['titlebar_border']};
                border-radius: 20px 20px 0 0;
            }}
            QLabel#dialogTitle {{
                color: {c['text']};
                margin-top: 2px;
            }}
            QToolButton#dialogCloseBtn {{
                background: transparent;
                color: {c['text_secondary']};
                border: none;
                border-radius: 8px;
                font-size: 14px;
            }}
            QToolButton#dialogCloseBtn:hover {{
                background: {c['btn_hover']};
                color: {c['danger']};
            }}
            QWidget#dialogContent {{
                background: {c['bg_white']};
                border-radius: 0 0 20px 20px;
            }}
            QLabel#dialogSubtitle {{
                color: {c['text_muted']};
                font-size: 14px;
            }}
            QLabel#formLabel {{
                color: {c['text_secondary']};
                font-size: 14px;
                font-weight: 500;
            }}
            QLineEdit#formInput, QSpinBox#formInput {{
                background: {c['bg']};
                color: {c['text']};
                border: 1.5px solid {c['border']};
                border-radius: 12px;
                padding: 12px 16px;
                font-size: 14px;
                min-height: 44px;
            }}
            QLineEdit#formInput:focus, QSpinBox#formInput:focus {{
                border-color: {c['primary']};
                background: {c['bg_white']};
                outline: none;
            }}
            QCheckBox#formCheckbox {{
                color: {c['text_secondary']};
                font-size: 14px;
                spacing: 10px;
                padding: 6px 0;
            }}
            QCheckBox#formCheckbox::indicator {{
                width: 22px;
                height: 22px;
                border-radius: 8px;
                border: 2px solid {c['border']};
            }}
            QCheckBox#formCheckbox::indicator:checked {{
                background: {c['primary']};
                border-color: {c['primary']};
            }}
            QPushButton#secondaryBtn {{
                background: {c['bg']};
                color: {c['text']};
                border: 1.5px solid {c['border']};
                border-radius: 12px;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 500;
            }}
            QPushButton#secondaryBtn:hover {{
                background: {c['btn_hover']};
                border-color: {c['border_light']};
            }}
            QPushButton#primaryBtn {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 {c['primary']}, stop:1 {c['primary_light']});
                color: white;
                border: none;
                border-radius: 12px;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton#primaryBtn:hover {{
                background: {c['primary_light']};
            }}
        """)

    def _on_theme_changed(self, colors: dict):
        self._apply_theme()

    def _on_save(self):
        name = self.name_input.text().strip()
        ip = self.ip_input.text().strip()
        port = self.port_input.value()
        user = self.user_input.text().strip()
        pwd = self.pwd_input.text()

        if not name:
            show_message(self, "验证失败", "连接名称不能为空", "warning")
            return
        if not ip or not validate_ip(ip):
            show_message(self, "验证失败", "请输入有效的IPv4地址", "warning")
            return
        if not user:
            show_message(self, "验证失败", "用户名不能为空", "warning")
            return
        if not self.connection and not pwd:
            show_message(self, "验证失败", "新建连接时密码不能为空", "warning")
            return

        self._result = {
            "client_name": name,
            "ip_address": ip,
            "port": port,
            "username": user,
            "password": pwd,
            "bastion_hosts": [
                k for k, cb in self.bastion_checks.items() if cb.isChecked()
            ],
        }
        self.accept()

    def get_data(self) -> dict:
        return getattr(self, "_result", {})


# ======================== 自定义标题栏 ========================
class TitleBar(QFrame):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._drag_pos = None
        self._is_maximized = False
        self._setup_ui()
        self._apply_theme()
        theme_manager.add_listener(self._on_theme_changed)

    def _setup_ui(self):
        self.setFixedHeight(48)
        self.setObjectName("titleBar")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 0, 0, 0)
        layout.setSpacing(12)

        # Logo 和标题
        logo_box = QHBoxLayout()
        logo_box.setSpacing(10)

        # Logo
        logo = QLabel(f"{Icons.SERVER}")
        logo.setFixedSize(36, 36)
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo.setObjectName("appLogo")
        logo_box.addWidget(logo)

        # 标题
        title_box = QVBoxLayout()
        title_box.setSpacing(1)
        
        self.title = QLabel("远程桌面管理工具")
        self.title.setObjectName("titleBarTitle")
        font = QFont()
        font.setPointSize(12)
        font.setBold(True)
        self.title.setFont(font)
        
        self.subtitle = QLabel("Windows 运维远程连接")
        self.subtitle.setObjectName("titleBarSubtitle")
        font = QFont()
        font.setPointSize(10)
        self.subtitle.setFont(font)
        
        title_box.addWidget(self.title)
        title_box.addWidget(self.subtitle)
        logo_box.addLayout(title_box)
        
        layout.addLayout(logo_box)
        layout.addStretch()

        # 窗口控制按钮
        controls = QHBoxLayout()
        controls.setSpacing(0)

        self.min_btn = QToolButton()
        self.min_btn.setObjectName("winBtn")
        self.min_btn.setFixedSize(48, 48)
        self.min_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.min_btn.clicked.connect(self._minimize)
        controls.addWidget(self.min_btn)

        self.max_btn = QToolButton()
        self.max_btn.setObjectName("winBtn")
        self.max_btn.setFixedSize(48, 48)
        self.max_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.max_btn.clicked.connect(self._maximize)
        controls.addWidget(self.max_btn)

        self.close_btn = QToolButton()
        self.close_btn.setObjectName("closeBtn")
        self.close_btn.setFixedSize(48, 48)
        self.close_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.close_btn.clicked.connect(self._close)
        controls.addWidget(self.close_btn)

        layout.addLayout(controls)

    def _apply_theme(self):
        c = theme_manager.colors
        self.setStyleSheet(f"""
            QFrame#titleBar {{
                background: {c['titlebar_bg']};
                border-bottom: 1px solid {c['titlebar_border']};
            }}
            QLabel#appLogo {{
                font-size: 20px;
            }}
            QLabel#titleBarTitle {{
                color: {c['titlebar_text']};
            }}
            QLabel#titleBarSubtitle {{
                color: {c['text_muted']};
            }}
            QToolButton#winBtn {{
                background: transparent;
                color: {c['text_secondary']};
                border: none;
                font-size: 14px;
                border-radius: 0;
            }}
            QToolButton#winBtn:hover {{
                background: {c['btn_hover']};
            }}
            QToolButton#closeBtn {{
                background: transparent;
                color: {c['text_secondary']};
                border: none;
                font-size: 14px;
                border-radius: 0;
            }}
            QToolButton#closeBtn:hover {{
                background: #e81123;
                color: white;
            }}
        """)

    def _on_theme_changed(self, colors: dict):
        self._apply_theme()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.window().frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton and self._drag_pos is not None:
            self.window().move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()

    def mouseDoubleClickEvent(self, event):
        self._maximize()

    def _minimize(self):
        self.window().showMinimized()

    def _maximize(self):
        if self._is_maximized:
            self.window().showNormal()
            self.max_btn.setText(Icons.MAXIMIZE)
            self._is_maximized = False
        else:
            self.window().showMaximized()
            self.max_btn.setText(Icons.RESTORE)
            self._is_maximized = True

    def _close(self):
        self.window().close()


# ======================== 主窗口 ========================
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.setMinimumSize(1000, 680)
        self.resize(1280, 768)

        self.store = ConnectionStore()
        self._connecting_id: Optional[str] = None
        self._connecting_proc = None
        self._connect_timer = None
        self._selected_index = -1  # 搜索键盘导航选中索引
        self._connection_cards: List[ConnectionCard] = []  # 当前显示的连接卡片

        self._setup_ui()
        self._apply_global_theme()
        self._load_connections()

        # 检查 DPAPI 可用性
        if not is_dpapi_available():
            show_message(self, "警告", "Windows DPAPI 不可用，请确保已正确安装 pywin32", "warning")

        theme_manager.add_listener(self._on_theme_changed)

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 标题栏
        self.title_bar = TitleBar(self)
        layout.addWidget(self.title_bar)

        # 工具栏
        toolbar = QFrame()
        toolbar.setObjectName("toolbar")
        toolbar.setFixedHeight(64)
        toolbar_layout = QHBoxLayout(toolbar)
        toolbar_layout.setContentsMargins(24, 0, 24, 0)
        toolbar_layout.setSpacing(16)

        # 搜索框
        search_frame = QFrame()
        search_frame.setObjectName("searchFrame")
        search_layout = QHBoxLayout(search_frame)
        search_layout.setContentsMargins(14, 0, 14, 0)
        search_layout.setSpacing(10)

        search_icon = QLabel(Icons.SEARCH)
        search_icon.setObjectName("searchIcon")
        search_layout.addWidget(search_icon)

        self.search_input = SearchLineEdit()
        self.search_input.setObjectName("searchInput")
        self.search_input.setPlaceholderText("搜索名称或 IP 地址...（↑↓选择，回车连接）")
        self.search_input.setFixedWidth(320)
        self.search_input.textChanged.connect(self._on_search)
        self.search_input.navigate_up.connect(self._navigate_up)
        self.search_input.navigate_down.connect(self._navigate_down)
        self.search_input.activate_selected.connect(self._activate_selected)
        search_layout.addWidget(self.search_input)

        toolbar_layout.addWidget(search_frame)
        toolbar_layout.addStretch()

        # 统计信息
        self.stats_label = QLabel("")
        self.stats_label.setObjectName("statsLabel")
        toolbar_layout.addWidget(self.stats_label)

        # 主题切换
        self.theme_btn = QToolButton()
        self.theme_btn.setObjectName("toolbarBtn")
        self.theme_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.theme_btn.setFixedHeight(36)
        self.theme_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        theme_menu = QMenu(self)
        theme_menu.addAction(f"{Icons.SUN} 亮色", lambda: self._set_theme(ThemeMode.LIGHT))
        theme_menu.addAction(f"{Icons.MOON} 暗色", lambda: self._set_theme(ThemeMode.DARK))
        theme_menu.addAction(f"{Icons.SYSTEM} 跟随系统", lambda: self._set_theme(ThemeMode.SYSTEM))
        self.theme_btn.setMenu(theme_menu)
        toolbar_layout.addWidget(self.theme_btn)

        # 导入/导出
        self.export_btn = QToolButton()
        self.export_btn.setObjectName("toolbarBtn")
        self.export_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.export_btn.setFixedHeight(36)
        self.export_btn.clicked.connect(self._on_export)
        toolbar_layout.addWidget(self.export_btn)

        self.import_btn = QToolButton()
        self.import_btn.setObjectName("toolbarBtn")
        self.import_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.import_btn.setFixedHeight(36)
        self.import_btn.clicked.connect(self._on_import)
        toolbar_layout.addWidget(self.import_btn)

        # 新建连接
        self.add_btn = QPushButton(f"{Icons.ADD} 新建连接")
        self.add_btn.setObjectName("primaryBtn")
        self.add_btn.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.add_btn.setFixedHeight(36)
        self.add_btn.setMinimumWidth(120)
        self.add_btn.clicked.connect(self._on_add)
        toolbar_layout.addWidget(self.add_btn)

        layout.addWidget(toolbar)

        # 内容区
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setObjectName("contentScroll")

        self.content_widget = QWidget()
        self.content_widget.setObjectName("contentWidget")
        self.content_layout = QGridLayout(self.content_widget)
        self.content_layout.setContentsMargins(24, 24, 24, 24)
        self.content_layout.setSpacing(20)
        self.content_layout.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)

        scroll.setWidget(self.content_widget)
        layout.addWidget(scroll)

    def _apply_global_theme(self):
        """应用全局主题样式"""
        c = theme_manager.colors
        
        # 设置主题按钮图标
        if theme_manager.is_dark:
            self.theme_btn.setText(f"{Icons.MOON} 暗色")
        else:
            self.theme_btn.setText(f"{Icons.SUN} 亮色")
        
        self.export_btn.setText(f"{Icons.EXPORT} 导出")
        self.import_btn.setText(f"{Icons.IMPORT} 导入")

        self.setStyleSheet(f"""
            /* 主窗口 */
            QMainWindow {{
                background: {c['bg']};
            }}

            /* 工具栏 */
            QFrame#toolbar {{
                background: {c['bg_white']};
                border-bottom: 1px solid {c['border']};
            }}

            /* 搜索框容器 */
            QFrame#searchFrame {{
                background: {c['bg']};
                border: 1.5px solid {c['border']};
                border-radius: 14px;
            }}
            QFrame#searchFrame:focus-within {{
                border-color: {c['primary']};
            }}
            QLabel#searchIcon {{
                color: {c['text_muted']};
                font-size: 16px;
            }}
            QLineEdit#searchInput {{
                background: transparent;
                color: {c['text']};
                border: none;
                padding: 8px 0px;
                font-size: 14px;
            }}
            QLineEdit#searchInput:focus {{
                outline: none;
            }}

            /* 统计信息 */
            QLabel#statsLabel {{
                color: {c['text_muted']};
                font-size: 13px;
                padding-right: 8px;
            }}

            /* 工具栏按钮 */
            QToolButton#toolbarBtn {{
                background: transparent;
                color: {c['text_secondary']};
                border: 1.5px solid {c['border']};
                border-radius: 12px;
                padding: 8px 16px;
                font-size: 13px;
            }}
            QToolButton#toolbarBtn:hover {{
                background: {c['btn_hover']};
                color: {c['text']};
                border-color: {c['border_light']};
            }}

            /* 主按钮 */
            QPushButton#primaryBtn {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 {c['primary']}, stop:1 {c['primary_light']});
                color: white;
                border: none;
                border-radius: 12px;
                padding: 8px 20px;
                font-size: 14px;
                font-weight: 600;
            }}
            QPushButton#primaryBtn:hover {{
                background: {c['primary_light']};
            }}

            /* 内容滚动区 */
            QScrollArea#contentScroll {{
                background: {c['bg']};
                border: none;
            }}
            QWidget#contentWidget {{
                background: {c['bg']};
            }}

            /* 菜单 */
            QMenu {{
                background: {c['bg_white']};
                color: {c['text']};
                border: 1px solid {c['border']};
                border-radius: 12px;
                padding: 8px;
            }}
            QMenu::item {{
                padding: 10px 28px;
                border-radius: 8px;
                font-size: 14px;
            }}
            QMenu::item:selected {{
                background: {c['primary_bg']};
                color: {c['primary']};
            }}

            /* 滚动条 */
            QScrollBar:vertical {{
                background: transparent;
                width: 8px;
                margin: 8px;
            }}
            QScrollBar::handle:vertical {{
                background: {c['scrollbar']};
                border-radius: 4px;
                min-height: 40px;
            }}
            QScrollBar::handle:vertical:hover {{
                background: {c['scrollbar_hover']};
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0px;
            }}
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{
                background: transparent;
            }}

            /* 空状态 */
            QFrame#emptyState {{
                background: transparent;
            }}
            QLabel#emptyIcon {{
                color: {c['text_muted']};
                font-size: 64px;
                margin-bottom: 8px;
            }}
            QLabel#emptyTitle {{
                color: {c['text']};
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 4px;
            }}
            QLabel#emptyDesc {{
                color: {c['text_muted']};
                font-size: 14px;
            }}
            QPushButton#emptyBtn {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 {c['primary']}, stop:1 {c['primary_light']});
                color: white;
                border: none;
                border-radius: 12px;
                padding: 12px 28px;
                font-size: 14px;
                font-weight: 600;
                margin-top: 16px;
            }}
            QPushButton#emptyBtn:hover {{
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
            }}
        """)

    def _on_theme_changed(self, colors: dict):
        """主题变化时重新应用全局样式"""
        self._apply_global_theme()
        for child in self.findChildren(QWidget):
            child.update()
            child.repaint()

    def _set_theme(self, mode: ThemeMode):
        theme_manager.mode = mode

    def _load_connections(self):
        """加载连接列表"""
        self._selected_index = -1  # 重置选中索引
        self._connection_cards = []  # 清空卡片列表

        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        connections = self.store.get_all()
        keyword = self.search_input.text().strip().lower()
        if keyword:
            connections = [
                c for c in connections
                if keyword in c.client_name.lower() or keyword in c.ip_address.lower()
            ]

        # 更新统计信息
        self.stats_label.setText(f"共 {len(connections)} 个连接")

        if not connections:
            # 清除网格布局中的所有内容
            while self.content_layout.count():
                item = self.content_layout.takeAt(0)
                if item.widget():
                    item.widget().deleteLater()
            
            # 创建空状态标签
            empty_label = QLabel()
            empty_label.setObjectName("emptyState")
            empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            empty_label.setWordWrap(True)
            
            c = theme_manager.colors
            empty_label.setStyleSheet(f"""
                QLabel#emptyState {{
                    color: {c['text_muted']};
                    font-size: 14px;
                    padding: 100px 20px;
                }}
            """)
            
            # 使用 HTML 来创建美观的空状态
            empty_label.setText(f"""
                <div style="text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 16px;">{Icons.NETWORK}</div>
                    <div style="font-size: 18px; font-weight: 600; color: {c['text']}; margin-bottom: 8px;">暂无远程桌面连接</div>
                    <div style="font-size: 14px; color: {c['text_muted']}; margin-bottom: 20px;">点击「新建连接」开始管理您的远程服务器</div>
                </div>
            """)
            
            self.content_layout.addWidget(empty_label, 0, 0, 1, 3)
            return

        for i, conn in enumerate(connections):
            card = ConnectionCard(conn)
            card.connect_clicked.connect(self._on_connect)
            card.edit_clicked.connect(self._on_edit)
            card.delete_clicked.connect(self._on_delete)
            card.view_password_clicked.connect(self._on_view_password)
            row = i // 3
            col = i % 3
            self.content_layout.addWidget(card, row, col)
            self._connection_cards.append(card)

    def _update_card_highlight(self):
        """更新卡片高亮状态"""
        for i, card in enumerate(self._connection_cards):
            is_selected = (i == self._selected_index)
            card.setProperty("selected", is_selected)
            # 更新边框样式以显示高亮
            c = theme_manager.colors
            if is_selected:
                card.setStyleSheet(f"""
                    QFrame#connectionCard {{
                        background: {c['bg_white']};
                        border: 2px solid {c['primary']};
                        border-radius: 16px;
                    }}
                """)
                # 滚动到选中的卡片
                card.ensureVisible(0, 0) if hasattr(card, 'ensureVisible') else None
            else:
                card._apply_theme()  # 恢复默认样式

    def _navigate_up(self):
        """键盘上键：向上选择"""
        if not self._connection_cards:
            return
        if self._selected_index <= 0:
            self._selected_index = len(self._connection_cards) - 1
        else:
            self._selected_index -= 1
        self._update_card_highlight()

    def _navigate_down(self):
        """键盘下键：向下选择"""
        if not self._connection_cards:
            return
        if self._selected_index >= len(self._connection_cards) - 1:
            self._selected_index = 0
        else:
            self._selected_index += 1
        self._update_card_highlight()

    def _activate_selected(self):
        """回车键：连接选中的服务器"""
        if self._selected_index < 0 or self._selected_index >= len(self._connection_cards):
            # 如果没有选中但只有一个卡片，自动连接
            if len(self._connection_cards) == 1:
                card = self._connection_cards[0]
                self._on_connect(card.connection.id)
            return
        card = self._connection_cards[self._selected_index]
        self._on_connect(card.connection.id)

    def _on_search(self):
        self._load_connections()

    def _on_add(self):
        dialog = ConnectionDialog(parent=self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            try:
                conn = Connection(
                    client_name=data["client_name"],
                    ip_address=data["ip_address"],
                    port=data["port"],
                    username=data["username"],
                    encrypted_password=encrypt_password_dpapi(data["password"]),
                    bastion_hosts=data["bastion_hosts"],
                )
                self.store.save(conn)
                self._load_connections()
            except Exception as e:
                show_message(self, "保存失败", str(e), "error")

    def _on_edit(self, conn_id: str):
        conn = self.store.get_by_id(conn_id)
        if not conn:
            return
        dialog = ConnectionDialog(conn, parent=self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            conn.client_name = data["client_name"]
            conn.ip_address = data["ip_address"]
            conn.port = data["port"]
            conn.username = data["username"]
            conn.bastion_hosts = data["bastion_hosts"]
            if data.get("password"):
                conn.encrypted_password = encrypt_password_dpapi(data["password"])
            self.store.update(conn)
            self._load_connections()

    def _on_delete(self, conn_id: str):
        if show_question(self, "确认删除", "确定删除此连接？"):
            self.store.delete(conn_id)
            self._load_connections()

    def _on_connect(self, conn_id: str):
        if self._connecting_id:
            show_message(self, "提示", "请等待当前连接完成", "info")
            return

        conn = self.store.get_by_id(conn_id)
        if not conn:
            return
        if not conn.encrypted_password:
            show_message(self, "连接失败", "该连接未设置密码", "warning")
            return

        try:
            password = decrypt_password_dpapi(conn.encrypted_password)
        except Exception as e:
            show_message(self, "解密失败", str(e), "error")
            return

        self._connecting_id = conn_id
        try:
            proc = start_rdp_connection(
                conn.ip_address, conn.port, conn.username, password
            )
            self._connecting_proc = proc
            self._connect_timer = QTimer(self)
            self._connect_timer.timeout.connect(self._check_connection)
            self._connect_timer.start(1000)
        except Exception as e:
            show_message(self, "连接失败", str(e), "error")
            self._connecting_id = None

    def _check_connection(self):
        if self._connecting_proc and self._connecting_proc.poll() is not None:
            cleanup_rdp(self._connecting_proc)
            self._connecting_id = None
            self._connecting_proc = None
            self._connect_timer.stop()
            self._connect_timer = None

    def _on_view_password(self, conn_id: str):
        conn = self.store.get_by_id(conn_id)
        if not conn or not conn.encrypted_password:
            return

        pwd, ok = show_input(self, "验证身份", "输入 Windows 登录密码：", password=True)
        if not ok or not pwd:
            return

        try:
            plaintext = decrypt_password_dpapi(conn.encrypted_password)
            show_message(self, "密码", f"连接密码：{plaintext}\n\n（30秒后请关闭此窗口）", "info")
        except Exception as e:
            show_message(self, "解密失败", str(e), "error")

    def _on_export(self):
        passphrase, ok = show_input(self, "导出连接列表", "设置导出密码（用于加密）：", password=True)
        if not ok or not passphrase:
            return

        path, _ = QFileDialog.getSaveFileName(
            self, "导出连接列表",
            "RDM连接列表.json",
            "JSON 文件 (*.json)"
        )
        if not path:
            return

        try:
            import json
            from datetime import datetime
            connections = self.store.get_all()
            export_data = {
                "version": "2.0",
                "exported_at": datetime.now().isoformat(),
                "count": len(connections),
                "connections": [],
            }
            for c in connections:
                item = {
                    "client_name": c.client_name,
                    "ip_address": c.ip_address,
                    "port": c.port,
                    "username": c.username,
                    "bastion_hosts": c.bastion_hosts,
                }
                if c.encrypted_password:
                    try:
                        plaintext = decrypt_password_dpapi(c.encrypted_password)
                        item["encrypted_password"] = portable_encrypt(plaintext, passphrase)
                    except Exception:
                        item["encrypted_password"] = ""
                export_data["connections"].append(item)

            Path(path).write_text(json.dumps(export_data, indent=2, ensure_ascii=False), encoding="utf-8")
            show_message(self, "导出成功", f"已导出 {len(connections)} 条连接", "success")
        except Exception as e:
            show_message(self, "导出失败", str(e), "error")

    def _on_import(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "导入连接列表", "", "JSON 文件 (*.json)"
        )
        if not path:
            return

        passphrase, ok = show_input(self, "导入连接列表", "输入导出时设置的密码：", password=True)
        if not ok or not passphrase:
            return

        try:
            import json
            data = json.loads(Path(path).read_text(encoding="utf-8"))
            count = 0
            for item in data.get("connections", []):
                if not item.get("client_name") or not item.get("ip_address"):
                    continue
                conn = Connection(
                    client_name=item["client_name"],
                    ip_address=item["ip_address"],
                    port=item.get("port", 3389),
                    username=item.get("username", ""),
                    bastion_hosts=item.get("bastion_hosts", []),
                )
                if item.get("encrypted_password"):
                    try:
                        plaintext = portable_decrypt(item["encrypted_password"], passphrase)
                        conn.encrypted_password = encrypt_password_dpapi(plaintext)
                    except Exception:
                        pass
                self.store.save(conn)
                count += 1
            self._load_connections()
            show_message(self, "导入成功", f"成功导入 {count} 条连接", "success")
        except Exception as e:
            show_message(self, "导入失败", str(e), "error")


def run_app():
    """启动应用"""
    app = QApplication(sys.argv)
    
    # 设置应用属性
    app_name = "Windows运维远程桌面管理工具"
    app.setApplicationName(app_name)
    app.setApplicationDisplayName(app_name)
    app.setOrganizationName("RDM")
    
    # 设置应用图标（任务管理器显示）
    icon_candidates = [
        Path(__file__).parent.parent.parent / "resources" / "icon.ico",
        Path(__file__).parent.parent / "resources" / "icon.ico",
        Path(__file__).parent / "assets" / "icon.ico",
    ]
    for icon_path in icon_candidates:
        if icon_path.exists():
            app.setWindowIcon(QIcon(str(icon_path)))
            break
    
    # 创建主窗口
    window = MainWindow()
    window.show()
    
    # 运行应用
    sys.exit(app.exec())
