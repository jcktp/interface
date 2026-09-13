import {WorkspaceViews,node,field,currency} from './views.js';
const label = text => text.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const editable = (name,type='text',extra={}) => field(name,label(name),type,{optional:true,...extra});
const clean = (values, nullable=[]) => Object.fromEntries(Object.entries(values).map(([key,value])=>[key,nullable.includes(key)&&value===''?null:value]));

export class EmployeeWorkspace extends WorkspaceViews {
  disclosure(title,content) {const item=node('details','','edit-section');item.append(node('summary',title),content);return item;}
  facts(title,values) {
    const card=node('section','','card');card.append(node('h2',title));
    const list=node('dl','','facts');
    for(const [key,value] of Object.entries(values)) {list.append(node('dt',label(key)),node('dd',value===null||value===undefined||value===''?'Not recorded':String(value)));}
    if(!Object.keys(values).length)card.append(node('p','No details have been recorded yet.','muted'));
    card.append(list);return card;
  }
  metrics(values) {const grid=node('div','','metric-grid');for(const [title,value] of values){const card=node('article','','card');card.append(node('p',title,'eyebrow'),node('h2',value===null||value===undefined?'—':String(value)));grid.append(card);}this.root.append(grid);}
  async profile(person) {
    this.heading('My workspace',`${person.preferred_name||person.name} · ${person.title||'Your employee portal'}`);
    const generation=this.generation;
    try {
      const [personal,bank,contract,employment,balance,tasks]=await Promise.all([
        this.api.request(`/employee/${person.id}/personal`),this.api.request(`/employee/${person.id}/bank`),this.api.request(`/employee/${person.id}/contract`),this.api.request(`/people/${person.id}/employment`),this.api.request(`/employee/${person.id}/leave/balance?year=${new Date().getFullYear()}`),this.api.request('/tasks?limit=100')]);
      if(generation!==this.generation)return;
      this.metrics([['Annual leave remaining',balance.remaining],['Awaiting leave approval',balance.requested],['Sickness weekdays',balance.sick],['Open tasks (first 100)',tasks.items.filter(t=>t.status==='open'&&t.person_id===person.id).length]]);
      this.root.append(node('p',balance.basis,'muted'));
      const shortcuts=node('div','','quick-actions');for(const [title,view] of [['Request / manage time off','leave'],['My onboarding','tasks']])shortcuts.append(this.action(title,()=>document.querySelector(`[data-view="${view}"]`).click()));this.root.append(shortcuts);
      this.root.append(this.facts('Employment',{work_email:person.email,role:person.title,department:person.department,start_date:employment?.hire_date,previous_company:employment?.previous_company,manager:contract.manager}));
      this.personalSection(person,personal,bank,()=>this.show('profile'));
      this.root.append(this.facts('My contract',Object.fromEntries(Object.entries(contract).filter(([key])=>key!=='version'))));
      this.root.append(this.disclosure('Preferred name',this.form('Update preferred name',[editable('preferred_name','text',{value:person.preferred_name,max:120})],async values=>{await this.api.request('/me/profile',{method:'PATCH',body:JSON.stringify({...values,version:person.version})});await this.show('profile');})));
      if(this.current.password_login)this.root.append(this.disclosure('Change password',this.form('Change password',[field('current_password','Current password','password'),field('new_password','New password','password')],async values=>{await this.api.request('/auth/password',{method:'POST',body:JSON.stringify(values)});await this.onLogout();})));
    }catch(error){if(generation===this.generation)this.root.append(node('p',error.message,'error'));}
  }
  personalSection(person,personal,bank,refresh) {
    const profile=this.facts('Personal & emergency details',{phone:personal.phone,personal_email:personal.personal_email,address:personal.address,date_of_birth:personal.date_of_birth,emergency_contact:personal.emergency_name,relationship:personal.emergency_relationship,emergency_phone:personal.emergency_phone});
    profile.append(this.disclosure('Update personal details',this.form('Personal details', ['phone','personal_email','address','date_of_birth','emergency_name','emergency_relationship','emergency_phone'].map(key=>editable(key,key==='date_of_birth'?'date':key==='personal_email'?'email':'text',{value:personal[key],max:key==='address'?500:120})),async values=>{await this.api.request(`/employee/${person.id}/personal`,{method:'PUT',body:JSON.stringify({...clean(values,['date_of_birth']),version:personal.version})});await refresh();})));
    const banking=this.facts('Payroll bank details',{account_holder:bank.holder,bank:bank.bank_name,account:bank.account_number,format:bank.format});
    banking.append(node('p','Bank details are encrypted in storage and masked here. Updating them replaces the existing account; no payment is initiated.','muted'));
    banking.append(this.disclosure('Add / replace bank details',this.form('Bank details',[field('holder','Account holder','text',{value:bank.holder}),field('bank_name','Bank name','text',{value:bank.bank_name}),field('format','Account format','select',{options:['iban','local'],value:bank.format}),field('account_number','Full account number / IBAN'),editable('routing_code','text')],async values=>{await this.api.request(`/employee/${person.id}/bank`,{method:'PUT',body:JSON.stringify({...values,version:bank.version})});await refresh();})));
    this.root.append(profile,banking);
  }
  async employeeRecord(person) {
    this.view='employee';const generation=++this.generation;this.root.replaceChildren();this.heading(person.name,'Employment, contract and private information. These records are restricted to the employee and HR; hiring assessments are HR-only.');
    try {
      const [personal,bank,contract,employment,talent,balance,history]=await Promise.all([this.api.request(`/employee/${person.id}/personal`),this.api.request(`/employee/${person.id}/bank`),this.api.request(`/employee/${person.id}/contract`),this.api.request(`/people/${person.id}/employment`),this.api.request(`/talent/${person.id}`),this.api.request(`/employee/${person.id}/leave/balance?year=${new Date().getFullYear()}`),this.api.request(`/talent/${person.id}/history`)]);
      if(generation!==this.generation)return;
      const refresh=()=>this.employeeRecord(person);
      this.root.append(this.facts('Employment',{start_date:employment?.hire_date,end_date:employment?.end_date,previous_company:employment?.previous_company,role:person.title,department:person.department}));
      this.root.append(this.disclosure('Edit employment dates',this.form('Employment',[field('hire_date','Employment start date','date',{value:employment?.hire_date}),editable('end_date','date',{value:employment?.end_date}),editable('previous_company','text',{value:employment?.previous_company})],async values=>{await this.api.request(`/people/${person.id}/employment`,{method:'PUT',body:JSON.stringify({...clean(values,['end_date']),version:employment?.version||0})});await refresh();})));
      this.root.append(this.facts('Contract',Object.fromEntries(Object.entries(contract).filter(([key])=>key!=='version'))));
      const contractFields=[field('contract_type','Contract type','select',{options:['permanent','fixed_term','contractor','internship'],value:contract.contract_type}),field('weekly_hours','Weekly hours','number',{step:'.01',value:contract.weekly_hours,min:0}),field('annual_salary','Annual salary','number',{step:'.01',value:contract.annual_salary,min:0}),{...currency,value:contract.currency},field('effective_date','Effective date','date',{value:contract.effective_date}),...['end_date','probation_end'].map(key=>editable(key,'date',{value:contract[key]})),...['notice_period','manager','location','terms'].map(key=>editable(key,'text',{value:contract[key],max:key==='terms'?4000:120}))];
      this.root.append(this.disclosure('Edit contract',this.form('Contract details',contractFields,async values=>{await this.api.request(`/employee/${person.id}/contract`,{method:'PUT',body:JSON.stringify({...clean(values,['end_date','probation_end']),version:contract.version})});await refresh();})));
      this.personalSection(person,personal,bank,refresh);
      this.root.append(this.facts('Annual leave',{year:balance.year,allowance:balance.days,approved:balance.approved,pending:balance.requested,remaining:balance.remaining}));
      this.root.append(this.disclosure('Set annual allowance',this.form('Annual allowance',[field('days','Monday–Friday days','number',{min:0,value:balance.days})],async values=>{await this.api.request(`/employee/${person.id}/leave/allowance`,{method:'PUT',body:JSON.stringify({...values,year:balance.year,version:balance.version})});await refresh();})));
      this.root.append(this.facts('Hiring & assessment',{recruiter:talent.recruiter,job:talent.job_title,source:talent.source,hiring_decision_date:talent.hired_date,quality_score:talent.quality_score,assessed_on:talent.assessed_on,score_basis:talent.score_basis}));
      if(history.items.length){const card=node('section','','card');card.append(node('h2','Assessment history'));for(const item of history.items)card.append(node('p',`${item.assessed_on||'Date not supplied'} · Quality ${item.quality_score??'—'} · ${item.score_basis||'No basis'} · Recorded ${item.recorded_at}`));this.root.append(card);}
      const fields=[...['recruiter','hiring_manager','source','job_id','job_title','location'].map(key=>editable(key,'text',{value:talent[key]})),...['applied_date','hired_date','assessed_on'].map(key=>editable(key,'date',{value:talent[key]})),...['quality_score','performance_rating','engagement_score','cost_per_hire'].map(key=>editable(key,'number',{step:'.01',value:talent[key]})),editable('score_basis','text',{max:1000,value:talent.score_basis}),{...currency,value:talent.currency}];
      this.root.append(this.disclosure('Edit hiring context / record an assessment',this.form('Hiring and quality of hire',fields,async values=>{await this.api.request(`/talent/${person.id}`,{method:'PUT',body:JSON.stringify({...clean(values,['applied_date','hired_date','assessed_on','quality_score','performance_rating','engagement_score','cost_per_hire']),version:talent.version})});await refresh();})));
    }catch(error){if(generation===this.generation)this.root.append(node('p',error.message,'error'));}
  }
  leave(data) {
    this.heading('Time off & sickness','Manage leave and report sickness. Annual balances use Monday–Friday days. Sickness is recorded immediately and does not consume annual leave.');
    if(this.current.person_id){
      this.root.append(this.disclosure('Request leave or report sickness',this.form('New absence',[field('kind','Type','select',{options:['annual','personal','sick']}),field('start_date','First day','date'),field('end_date','Last day / expected last sick day','date'),editable('note','text',{max:1000})],async values=>{await this.api.request('/leave',{method:'POST',body:JSON.stringify(values)});await this.show('leave');})));
      this.root.append(node('p','No diagnosis is required for sickness. Update the last day when you extend the absence or return.','muted'));
    }
    this.list(data.items,item=>{
      const card=node('article','','card');card.append(node('h2',`${item.name} · ${item.kind==='sick'?'Sickness':label(item.kind)}`),node('p',`${item.start_date} → ${item.end_date}`),node('span',item.kind==='sick'&&item.status==='approved'?'Reported':item.status,'badge'),node('p',item.note));
      const act=action=>async()=>{await this.api.request(`/leave/${item.id}/transition`,{method:'POST',body:JSON.stringify({action,version:item.version})});await this.show('leave',false);};
      if(this.current.role==='admin'&&this.current.person_id&&this.current.person_id!==item.person_id&&item.status==='requested')card.append(this.action('Approve',act('approve')),this.action('Reject',act('reject')));
      if(this.current.person_id===item.person_id&&['requested','approved'].includes(item.status))card.append(this.action('Cancel absence',act('cancel')));
      if(this.current.person_id===item.person_id&&item.kind==='sick'&&item.status==='approved')card.append(this.disclosure('Update last sick day / record return',this.form('Last sick day',[field('end_date','Last sick day','date',{value:item.end_date})],async values=>{await this.api.request(`/leave/${item.id}/sickness`,{method:'PUT',body:JSON.stringify({...values,version:item.version})});await this.show('leave');})));
      return card;
    });
  }
  talent(data) {
    this.heading('Hiring & quality of hire','Understand hiring outcomes using recorded assessments and employment dates. Missing scores remain missing; these are descriptive cohorts, not automated employment recommendations.');
    this.metrics([['People in cohort',data.people],['Quality of hire / 100',data.quality],['Scored people',data.scored],['90-day retention %',data.retention_90]]);
    this.root.append(node('p',`Quality coverage ${data.scored}/${data.people} · Retention: ${data.retention_sample} eligible records, ${data.retention_unknown} unknown end dates. Newer hires are excluded from the 90-day denominator.`,'muted'));
    this.root.append(this.disclosure('Filter hire cohort',this.form('Cohort filters',[editable('department'),editable('start','date'),editable('end','date')],async values=>{const query=new URLSearchParams(Object.entries(values).filter(([,v])=>v));const result=await this.api.request('/talent?'+query);this.root.replaceChildren();this.talent(result);})));
    this.metrics([['Performance / 5',data.performance],['Performance sample',data.performance_sample],['Engagement / 100',data.engagement],['Engagement sample',data.engagement_sample]]);
    this.root.append(node('p',`Average application-to-hiring-decision time: ${data.hiring_cycle_days??'—'} days (${data.hiring_cycle_sample} complete records).`));
    for(const cost of data.costs||[])this.root.append(node('p',`Average recorded hiring cost: ${cost.currency} ${cost.average_cost} (${cost.sample} records).`));
    for(const [title,key] of [['By recruiter','by_recruiter'],['By source','by_source'],['By department','by_department'],['By previous company','by_previous_company'],['Hire-quarter cohorts','cohorts']]){
      const card=node('section','','card');card.append(node('h2',title));
      if(!data[key].length)card.append(node('p','Import employee records or review ATS hires to populate this view.','muted'));
      for(const item of data[key]){const row=node('div','','cohort-row');row.append(node('strong',item.name),node('span',`${item.quality??'—'} / 100 · ${item.scored} scored / ${item.people} people`));if(item.quality!==null){const meter=node('meter');meter.min=0;meter.max=100;meter.value=item.quality;meter.setAttribute('aria-label',`${item.name} quality score`);row.append(meter);}card.append(row);}this.root.append(card);
    }
    this.root.append(this.facts('Score distribution',Object.fromEntries(data.distribution.map(item=>[item.range,item.count]))));
  }
  imports() {
    this.heading('Import employee data','Upload a CSV, map your columns and preview changes before importing. Up to 1,000 rows; blank cells preserve existing values. No accounts are created.');
    this.root.append(this.action('Export payroll details',async()=>{const result=await this.api.request('/payroll/export',{method:'POST'});this.download('interface-payroll.csv',result.csv);}));
    const card=node('section','','card'),input=node('input');input.type='file';input.accept='.csv,text/csv';input.setAttribute('aria-label','Choose employee CSV');card.append(input);this.root.append(card);
    const hint=node('p','Required: name and email. Optional: hire_date (employment start), previous_company, recruiter, job_title, hired_date (decision date), source, quality_score, assessed_on, score_basis and more. Dates use YYYY-MM-DD.','muted');card.append(hint);
    input.onchange=async()=>{
      const file=input.files[0];if(!file)return;
      if(file.size>2_000_000){card.append(node('p','Choose a CSV smaller than 2 MB.','error'));return;}
      const generation=++this.generation;
      try {
        const content=await file.text();const info=await this.api.request('/imports/inspect',{method:'POST',body:JSON.stringify({content})});
        if(generation!==this.generation)return;
        this.root.replaceChildren();this.heading('Map CSV columns',`${file.name} · ${info.count} rows`);
        const aliases={full_name:'name',work_email:'email',start_date:'hire_date',quality_of_hire_score:'quality_score',hired_by:'recruiter'};
        const fields=info.headers.map((header,index)=>field('column'+index,header,'select',{options:[{value:'Ignore',label:'Ignore this column'},...info.fields.map(value=>({value,label:({hire_date:'Employment start date',hired_date:'Hiring decision date',quality_score:'Quality of hire (0–100)'})[value]||label(value)}))],value:info.fields.includes(header)?header:aliases[header]||'Ignore'}));
        fields.push(field('mode','When an email already exists','select',{options:[{value:'create_only',label:'Only create new people'},{value:'upsert',label:'Create new people and update matching emails'}]}));
        this.root.append(this.form('Choose destination fields',fields,async values=>{
          const mapping={};for(let index=0;index<info.headers.length;index++){const target=values['column'+index];if(target==='Ignore')continue;if(mapping[target])throw new Error('Map each destination only once.');mapping[target]=info.headers[index];}
          const result=await this.api.request('/imports/preview',{method:'POST',body:JSON.stringify({content,mapping,mode:values.mode})});this.importPreview(result);
        }));
      }catch(error){if(generation===this.generation)this.root.append(node('p',error.message,'error'));}
    };
  }
  importPreview(result) {
    const old=this.root.querySelector('[data-preview]');if(old)old.remove();
    const card=node('section','','card');card.dataset.preview='true';card.append(node('h2',`Preview: ${result.creates} new · ${result.updates} updates · ${result.errors.length} errors`));
    for(const error of result.errors)card.append(node('p',`Row ${error.row}: ${error.message}`,'error'));
    if(result.errors.length)card.append(this.action('Download errors',()=>{const text='row,error\n'+result.errors.map(e=>`${e.row},"${e.message.replaceAll('"','""')}"`).join('\n');this.download('import-errors.csv',text);}));
    for(const row of result.rows.slice(0,25))card.append(node('p',`${row.row}. ${row.person.name} · ${row.person.email} · ${row.person_id?'Update':'Create'} · Start ${row.employment?.hire_date||'unchanged'} · Quality ${row.talent?.quality_score??'not supplied'}`));
    if(result.rows.length>25)card.append(node('p',`Showing 25 of ${result.rows.length} validated rows.`,'muted'));
    if(result.batch_id)card.append(this.action('Confirm import',async()=>{const saved=await this.api.request(`/imports/${result.batch_id}/commit`,{method:'POST'});this.root.replaceChildren();this.heading('Import complete',`${saved.imported} employee records saved.`);this.root.append(this.action('Open people',()=>document.querySelector('[data-view="directory"]').click()));}));
    this.root.append(card);
  }
  download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const link=node('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  hires(data) {
    this.heading('Hire inbox','Review hires from Ashby before creating employees. Confirm work email and employment start date; application date is never treated as a hiring decision date.');
    if(!data.items.length)this.root.append(node('p','Add an “Ashby · hired applications” connection, then sync it to bring hires here.','empty-card'));
    for(const item of data.items){
      const card=this.facts(item.name,{job:item.job_title,job_id:item.job_id,recruiter:item.recruiter,hiring_manager:item.hiring_manager,source:item.source,applied_date:item.applied_date});
      if(item.person_id)card.append(node('p','Imported into the employee directory.','badge'));
      else card.append(this.disclosure('Review & create employee',this.form('Confirm employment',[field('name','Full name','text',{value:item.name}),field('email','Work email','email'),field('hire_date','Employment start date','date'),editable('hired_date','date'),editable('department'),editable('recruiter','text',{value:item.recruiter})],async values=>{await this.api.request(`/hires/${encodeURIComponent(item.connection_id)}/${encodeURIComponent(item.external_id)}/accept`,{method:'POST',body:JSON.stringify({...clean(values,['hired_date']),version:item.version})});await this.show('hires');})));
      this.root.append(card);
    }
  }
}
