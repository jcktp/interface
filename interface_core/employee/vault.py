import os
from cryptography.fernet import Fernet

class PrivateVault:
    def __init__(self, path):
        path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists():
            with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as stream:
                stream.write(Fernet.generate_key())
        self.cipher=Fernet(path.read_bytes())

    def encrypt(self,value): return self.cipher.encrypt(value.encode()).decode()
    def decrypt(self,value): return self.cipher.decrypt(value.encode()).decode()
