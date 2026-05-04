"""SQLAlchemy ORM models for chef workflow entities."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class InventoryAdjustmentRequest(Base):
    __tablename__ = "inventory_adjustment_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'auto-approved', 'rejected')",
            name="ck_inventory_adjustment_requests_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("inventory_items.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        onupdate=_utc_now,
        server_default=text("CURRENT_TIMESTAMP"),
    )


class AiChefMessage(Base):
    __tablename__ = "ai_chef_messages"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_chef', 'replied_by_chef', 'delivered_to_customer')",
            name="ck_ai_chef_messages_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    complex_request_text: Mapped[str] = mapped_column(Text, nullable=False)
    chef_reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_filtered_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending_chef",
        server_default=text("'pending_chef'"),
    )