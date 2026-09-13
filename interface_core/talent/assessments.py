import json
from datetime import datetime,timezone

class AssessmentHistory:
    FIELDS=('quality_score','assessed_on','score_basis','performance_rating','engagement_score')
    def record(self,db,actor,person_id,data,previous=None):
        values={key:data.get(key) for key in self.FIELDS}
        before={key:(previous or {}).get(key) for key in self.FIELDS}
        if values==before:return
        if all(values.get(key) is None for key in ('quality_score','performance_rating','engagement_score')) and not previous:return
        db.execute('INSERT INTO quality_assessments(person_id,payload,actor,recorded_at) VALUES (?,?,?,?)',(person_id,json.dumps(values),actor.name,datetime.now(timezone.utc).isoformat()))
