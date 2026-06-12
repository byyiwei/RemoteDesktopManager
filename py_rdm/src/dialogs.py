"""
自定义弹窗组件 - 替代系统原生 QMessageBox / QInputDialog
"""
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QLineEdit, QFrame, QGraphicsDropShadowEffect
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont, QColor

from .themes import theme_manager


class CustomDialog(QDialog):
    """自定义弹窗基类"""

    def __init__(self, parent=None, title="", width=400):
        super().__init__(parent)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Dialog)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setMinimumWidth(width)
        self.setMaximumWidth(480)
        self._title = title
        self._setup_base()
        theme_manager.add_listener(self._on_theme_changed)

    def _setup_base(self):
        """设置基础布局"""
        # 主容器（带圆角和背景）
        self.container = QFrame(self)
        self.container.setObjectName("dialogContainer")
        self.container.setFrameShape(QFrame.Shape.NoFrame)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.addWidget(self.container)

        self.content_layout = QVBoxLayout(self.container)
        self.content_layout.setContentsMargins(28, 24, 28, 24)
        self.content_layout.setSpacing(16)

        # 标题栏
        header = QHBoxLayout()
        self.title_label = QLabel(self._title)
        self.title_label.setObjectName("dialogTitle")
        font = QFont()
        font.setPointSize(15)
        font.setBold(True)
        self.title_label.setFont(font)
        header.addWidget(self.title_label)
        header.addStretch()

        self.close_btn = QPushButton("✕")
        self.close_btn.setObjectName("dialogCloseBtn")
        self.close_btn.setFixedSize(32, 32)
        self.close_btn.clicked.connect(self.reject)
        header.addWidget(self.close_btn)
        self.content_layout.addLayout(header)

        # 分隔线
        sep = QFrame()
        sep.setObjectName("dialogSep")
        sep.setFixedHeight(1)
        self.content_layout.addWidget(sep)

        # 阴影效果
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(40)
        shadow.setColor(QColor(0, 0, 0, 60))
        shadow.setOffset(0, 8)
        self.container.setGraphicsEffect(shadow)

        self._apply_theme()

    def _apply_theme(self):
        c = theme_manager.colors
        self.container.setStyleSheet(f"""
            QFrame#dialogContainer {{
                background: {c['bg_white']};
                border: 1px solid {c['border']};
                border-radius: 20px;
            }}
            QLabel#dialogTitle {{
                color: {c['text']};
            }}
            QFrame#dialogSep {{
                background: {c['border_light']};
            }}
            QPushButton#dialogCloseBtn {{
                background: transparent;
                color: {c['text_muted']};
                border: none;
                border-radius: 8px;
                font-size: 14px;
            }}
            QPushButton#dialogCloseBtn:hover {{
                background: {c['btn_hover']};
                color: {c['text']};
            }}
        """)

    def _on_theme_changed(self, colors: dict):
        self._apply_theme()

    def closeEvent(self, event):
        theme_manager.remove_listener(self._on_theme_changed)
        event.accept()


class MessageDialog(CustomDialog):
    """消息提示弹窗"""

    def __init__(self, parent=None, title="提示", message="", msg_type="info"):
        super().__init__(parent, title, width=380)
        self.msg_type = msg_type
        self._setup_content(message)

    def _setup_content(self, message: str):
        # 消息图标和文字
        msg_layout = QHBoxLayout()
        msg_layout.setSpacing(16)

        # 类型图标颜色
        icon_colors = {
            "info": "#3b82f6",
            "warning": "#f59e0b",
            "error": "#ef4444",
            "success": "#22c55e",
            "question": "#3b82f6",
        }
        color = icon_colors.get(self.msg_type, "#3b82f6")

        # SVG 图标
        icon_label = QLabel()
        icon_label.setFixedSize(40, 40)
        icon_label.setStyleSheet(f"""
            background: {color}18;
            border-radius: 20px;
            color: {color};
            font-size: 18px;
            font-weight: bold;
        """)
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        icons = {"info": "i", "warning": "!", "error": "✕", "success": "✓", "question": "?"}
        icon_label.setText(icons.get(self.msg_type, "i"))
        msg_layout.addWidget(icon_label)

        # 消息文字
        self.msg_label = QLabel(message)
        self.msg_label.setObjectName("msgLabel")
        self.msg_label.setWordWrap(True)
        self.msg_label.setStyleSheet(f"color: {theme_manager.colors['text_secondary']}; font-size: 14px; line-height: 1.5;")
        msg_layout.addWidget(self.msg_label, 1)
        self.content_layout.addLayout(msg_layout)

        # 按钮区
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        if self.msg_type == "question":
            self.no_btn = QPushButton("取消")
            self.no_btn.setObjectName("secondaryBtn")
            self.no_btn.setFixedHeight(38)
            self.no_btn.clicked.connect(self.reject)
            btn_layout.addWidget(self.no_btn)

            self.yes_btn = QPushButton("确定")
            self.yes_btn.setObjectName("primaryBtn")
            self.yes_btn.setFixedHeight(38)
            self.yes_btn.clicked.connect(self.accept)
            btn_layout.addWidget(self.yes_btn)
        else:
            self.ok_btn = QPushButton("确定")
            self.ok_btn.setObjectName("primaryBtn")
            self.ok_btn.setFixedHeight(38)
            self.ok_btn.clicked.connect(self.accept)
            btn_layout.addWidget(self.ok_btn)

        self.content_layout.addLayout(btn_layout)
        self._apply_btn_theme()

    def _apply_btn_theme(self):
        c = theme_manager.colors
        self.setStyleSheet(self.styleSheet() + f"""
            QPushButton#primaryBtn {{
                background: {c['primary']};
                color: white;
                border: none;
                border-radius: 10px;
                padding: 8px 24px;
                font-size: 14px;
                font-weight: 600;
                min-width: 90px;
            }}
            QPushButton#primaryBtn:hover {{
                background: {c['primary_light']};
            }}
            QPushButton#secondaryBtn {{
                background: {c['bg_elevated']};
                color: {c['text']};
                border: 1px solid {c['border']};
                border-radius: 10px;
                padding: 8px 24px;
                font-size: 14px;
                min-width: 90px;
            }}
            QPushButton#secondaryBtn:hover {{
                background: {c['btn_hover']};
            }}
        """)


class InputDialog(CustomDialog):
    """输入弹窗"""

    confirmed = pyqtSignal(str)

    def __init__(self, parent=None, title="", label="", placeholder="", password=False):
        super().__init__(parent, title, width=400)
        self._setup_content(label, placeholder, password)

    def _setup_content(self, label: str, placeholder: str, password: bool):
        # 标签
        self.input_label = QLabel(label)
        self.input_label.setObjectName("inputLabel")
        self.input_label.setStyleSheet(f"color: {theme_manager.colors['text_secondary']}; font-size: 14px;")
        self.content_layout.addWidget(self.input_label)

        # 输入框
        self.input_field = QLineEdit()
        self.input_field.setObjectName("inputField")
        self.input_field.setPlaceholderText(placeholder)
        if password:
            self.input_field.setEchoMode(QLineEdit.EchoMode.Password)
        self.input_field.setFixedHeight(44)
        self.content_layout.addWidget(self.input_field)

        # 按钮区
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setObjectName("secondaryBtn")
        self.cancel_btn.setFixedHeight(38)
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)

        self.confirm_btn = QPushButton("确定")
        self.confirm_btn.setObjectName("primaryBtn")
        self.confirm_btn.setFixedHeight(38)
        self.confirm_btn.clicked.connect(self._on_confirm)
        btn_layout.addWidget(self.confirm_btn)

        self.content_layout.addLayout(btn_layout)
        self._apply_input_theme()

        # 回车确认
        self.input_field.returnPressed.connect(self._on_confirm)

    def _apply_input_theme(self):
        c = theme_manager.colors
        self.setStyleSheet(self.styleSheet() + f"""
            QLineEdit#inputField {{
                background: {c['bg']};
                color: {c['text']};
                border: 1.5px solid {c['border']};
                border-radius: 12px;
                padding: 10px 16px;
                font-size: 14px;
            }}
            QLineEdit#inputField:focus {{
                border-color: {c['primary']};
                background: {c['bg_white']};
            }}
            QPushButton#primaryBtn {{
                background: {c['primary']};
                color: white;
                border: none;
                border-radius: 10px;
                padding: 8px 24px;
                font-size: 14px;
                font-weight: 600;
                min-width: 90px;
            }}
            QPushButton#primaryBtn:hover {{
                background: {c['primary_light']};
            }}
            QPushButton#secondaryBtn {{
                background: {c['bg_elevated']};
                color: {c['text']};
                border: 1px solid {c['border']};
                border-radius: 10px;
                padding: 8px 24px;
                font-size: 14px;
                min-width: 90px;
            }}
            QPushButton#secondaryBtn:hover {{
                background: {c['btn_hover']};
            }}
        """)

    def _on_confirm(self):
        self.confirmed.emit(self.input_field.text())
        self.accept()

    def get_text(self) -> str:
        return self.input_field.text()


# ======================== 便捷函数 ========================

def show_message(parent, title: str, message: str, msg_type: str = "info"):
    """显示消息弹窗"""
    dialog = MessageDialog(parent, title, message, msg_type)
    return dialog.exec() == QDialog.DialogCode.Accepted


def show_question(parent, title: str, message: str) -> bool:
    """显示确认弹窗"""
    dialog = MessageDialog(parent, title, message, "question")
    return dialog.exec() == QDialog.DialogCode.Accepted


def show_input(parent, title: str, label: str, placeholder: str = "", password: bool = False) -> tuple:
    """显示输入弹窗，返回 (text, ok)"""
    dialog = InputDialog(parent, title, label, placeholder, password)
    if dialog.exec() == QDialog.DialogCode.Accepted:
        return dialog.get_text(), True
    return "", False
