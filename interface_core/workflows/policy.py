from ..policy import Actor, DirectoryPolicy, DomainError


class WorkflowPolicy(DirectoryPolicy):
    def named(self, actor: Actor):
        if not actor.person_id or actor.role not in ('admin', 'employee'):
            raise DomainError(403, 'Sign in with a named employee account')

    def view(self, actor: Actor, owner: str):
        if actor.role != 'admin' and actor.person_id != owner:
            raise DomainError(404, 'Record not found')

    def decide_leave(self, actor: Actor, request, action: str):
        if action in ('approve', 'reject'):
            self.named(actor)
            self.authorize(actor, write=True)
            if actor.person_id == request['person_id']:
                raise DomainError(403, 'You cannot approve or reject your own leave')
        else:
            self.named(actor)
            if actor.person_id != request['person_id']:
                raise DomainError(403, 'Only the requester can cancel their leave')
