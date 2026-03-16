"""Backward-compatibility shim.

This project has migrated from OpenAI to Gemini.
Import ChatBot from this module will continue to work.
"""

from services.ai_service import ChatBot

__all__ = ["ChatBot"]
