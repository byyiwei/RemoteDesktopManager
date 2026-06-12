"""
数据存储模块 - SQLite
"""
import sqlite3
import json
import os
from pathlib import Path
from typing import List, Optional
from .models import Connection


class ConnectionStore:
    """连接数据存储"""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            # 使用项目目录下的data文件夹存储数据库
            project_dir = Path(__file__).parent.parent
            self.db_dir = project_dir / "data"
            self.db_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = self.db_dir / "connections.db"
        else:
            self.db_path = Path(db_path)
            self.db_dir = self.db_path.parent
            self.db_dir.mkdir(parents=True, exist_ok=True)

        self._init_db()

    def _init_db(self):
        """初始化数据库表"""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    client_name TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    port INTEGER DEFAULT 3389,
                    username TEXT NOT NULL,
                    encrypted_password TEXT DEFAULT '',
                    bastion_hosts TEXT DEFAULT '[]',
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            conn.commit()

    def get_all(self) -> List[Connection]:
        """获取所有连接"""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM connections ORDER BY updated_at DESC")
            rows = cursor.fetchall()
            return [self._row_to_connection(row) for row in rows]

    def get_by_id(self, conn_id: str) -> Optional[Connection]:
        """根据ID获取连接"""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM connections WHERE id = ?", (conn_id,))
            row = cursor.fetchone()
            return self._row_to_connection(row) if row else None

    def save(self, connection: Connection) -> Connection:
        """保存新连接"""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute(
                """INSERT INTO connections
                    (id, client_name, ip_address, port, username,
                     encrypted_password, bastion_hosts, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    connection.id,
                    connection.client_name,
                    connection.ip_address,
                    connection.port,
                    connection.username,
                    connection.encrypted_password,
                    json.dumps(connection.bastion_hosts),
                    connection.created_at,
                    connection.updated_at,
                ),
            )
            conn.commit()
        return connection

    def update(self, connection: Connection) -> Connection:
        """更新连接"""
        connection.updated_at = Connection.__dataclass_fields__["updated_at"].default_factory()
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute(
                """UPDATE connections SET
                    client_name = ?,
                    ip_address = ?,
                    port = ?,
                    username = ?,
                    encrypted_password = ?,
                    bastion_hosts = ?,
                    updated_at = ?
                WHERE id = ?""",
                (
                    connection.client_name,
                    connection.ip_address,
                    connection.port,
                    connection.username,
                    connection.encrypted_password,
                    json.dumps(connection.bastion_hosts),
                    connection.updated_at,
                    connection.id,
                ),
            )
            conn.commit()
        return connection

    def delete(self, conn_id: str) -> bool:
        """删除连接"""
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("DELETE FROM connections WHERE id = ?", (conn_id,))
            conn.commit()
            return cursor.rowcount > 0

    def _row_to_connection(self, row: sqlite3.Row) -> Connection:
        """将数据库行转换为Connection对象"""
        return Connection(
            id=row["id"],
            client_name=row["client_name"],
            ip_address=row["ip_address"],
            port=row["port"],
            username=row["username"],
            encrypted_password=row["encrypted_password"],
            bastion_hosts=json.loads(row["bastion_hosts"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
