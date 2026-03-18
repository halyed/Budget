from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    allowed_origins: str = "http://localhost:4200"
    secret_key: str
    admin_username: str = "admin"
    admin_password: str
    admin_email: str = "admin@localhost"
    registration_enabled: bool = True

    # Dev
    debug: bool = False

    # AI
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "phi3:mini"

    # Email (Yahoo SMTP)
    mail_user: Optional[str] = None
    mail_password: Optional[str] = None
    mail_host: str = "smtp.mail.yahoo.com"
    mail_port: int = 587
    app_url: str = "http://localhost"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def mail_enabled(self) -> bool:
        return bool(self.mail_user and self.mail_password)

    class Config:
        env_file = ".env"


settings = Settings()
