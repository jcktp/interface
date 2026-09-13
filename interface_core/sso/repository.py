import sqlite3
from ..events import ActivityJournal
from ..policy import DomainError


class SQLiteSSORepository:
    def __init__(self, database, journal=None):
        self.database = database
        self.journal = journal or ActivityJournal()

    def list_links(self):
        with self.database.connect() as db:
            return [dict(row) for row in db.execute('SELECT l.*,p.name,p.email FROM sso_links l JOIN users u ON u.id=l.user_id JOIN people p ON p.id=u.person_id ORDER BY p.name,l.issuer')]

    def link(self, actor, issuer, subject, user_id):
        try:
            with self.database.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                row = db.execute("SELECT u.id FROM users u JOIN people p ON p.id=u.person_id WHERE u.id=? AND u.active=1 AND p.status='active'",(user_id,)).fetchone()
                if not row:
                    raise DomainError(422, 'Choose an active Interface account')
                existing = db.execute('SELECT user_id FROM sso_links WHERE issuer=? AND subject=?',(issuer,subject)).fetchone()
                if existing and existing['user_id'] == user_id:
                    return {'user_id':user_id, 'subject':subject, 'issuer':issuer}
                db.execute('INSERT INTO sso_links VALUES (?,?,?)',(issuer,subject,user_id))
                self.journal.record(db,'account',user_id,'account.sso_linked.v1',actor.name)
        except sqlite3.IntegrityError:
            raise DomainError(409, 'This identity or account is already linked for this issuer. Unlink it before changing the mapping.') from None
        return {'user_id':user_id, 'subject':subject, 'issuer':issuer}

    def unlink(self, actor, issuer, user_id):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            changed = db.execute('DELETE FROM sso_links WHERE issuer=? AND user_id=?',(issuer,user_id)).rowcount
            if not changed:
                raise DomainError(404, 'SSO link not found')
            db.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
            db.execute('DELETE FROM sso_handoffs WHERE user_id=?',(user_id,))
            self.journal.record(db,'account',user_id,'account.sso_unlinked.v1',actor.name)

    def begin(self, state_hash, browser_hash, provider, nonce, verifier, now):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM sso_attempts WHERE expires_at<=?',(now,))
            db.execute('DELETE FROM sso_handoffs WHERE expires_at<=?',(now,))
            if db.execute('SELECT count(*) FROM sso_attempts').fetchone()[0] >= 10000:
                raise DomainError(429, 'Too many sign-in attempts; try again later')
            db.execute('INSERT INTO sso_attempts VALUES (?,?,?,?,?,?)',(state_hash,browser_hash,provider,nonce,verifier,now+300))

    def consume(self, state_hash, browser_hash, provider, now):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM sso_attempts WHERE state_hash=? AND browser_hash=? AND provider=? AND expires_at>?',(state_hash,browser_hash,provider,now)).fetchone()
            if not row:
                raise DomainError(401, 'Sign-in expired or could not be verified. Start again.')
            db.execute('DELETE FROM sso_attempts WHERE state_hash=?',(state_hash,))
            return dict(row)

    def handoff(self, issuer, subject, token_hash, now):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT u.id FROM sso_links l JOIN users u ON u.id=l.user_id JOIN people p ON p.id=u.person_id WHERE l.issuer=? AND l.subject=? AND u.active=1 AND p.status='active'",(issuer,subject)).fetchone()
            if not row:
                raise DomainError(403, 'Your identity is not linked to an active Interface account. Ask your administrator to link it.')
            db.execute('INSERT INTO sso_handoffs VALUES (?,?,?)',(token_hash,row['id'],now+60))
            self.journal.record(db,'account',row['id'],'account.sso_verified.v1',row['id'])

    def exchange(self, handoff_hash, session_hash, now):
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT u.id FROM sso_handoffs h JOIN users u ON u.id=h.user_id JOIN people p ON p.id=u.person_id WHERE h.token_hash=? AND h.expires_at>? AND u.active=1 AND p.status='active'",(handoff_hash,now)).fetchone()
            if not row:
                raise DomainError(401, 'Sign-in handoff expired or was already used. Start again.')
            db.execute('DELETE FROM sso_handoffs WHERE token_hash=?',(handoff_hash,))
            db.execute('DELETE FROM sessions WHERE expires_at<=?',(now,))
            db.execute('INSERT INTO sessions VALUES (?,?,?)',(session_hash,row['id'],now+12*3600))
            self.journal.record(db,'account',row['id'],'account.sso_session_created.v1',row['id'])
