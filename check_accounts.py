from core.db import engine, AccountModel
from sqlmodel import Session, select
with Session(engine) as session:
    count = session.exec(select(AccountModel).where(AccountModel.platform == "trae")).all()
    print("COUNT:", len(count))
