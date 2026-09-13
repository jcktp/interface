export const node = (tag, text = '', className = '') => {
  const item = document.createElement(tag); item.textContent = text; item.className = className; return item;
};
export const field = (name, label, type = 'text', extra = {}) => ({name, label, type, ...extra});
export const currency = field('currency', 'Currency', 'select', {options: ['EUR', 'USD', 'GBP']});

export class WorkspaceViews {
  constructor(api, current, onLogout) {
    this.api = api; this.current = current; this.onLogout = onLogout;
    this.root = document.getElementById('workspace'); this.view = ''; this.offset = 0; this.generation = 0;
  }
  clear() { this.generation++; this.root.replaceChildren(); }
  async show(view, reset = true) {
    if (reset) this.offset = 0;
    this.view = view; const generation = ++this.generation;
    this.root.replaceChildren(node('p', 'Loading…', 'muted'));
    try {
      const result = await this.api.request({profile:'/me/profile',leave:'/leave',tasks:'/tasks',accounts:'/accounts',insights:'/insights',connectors:'/connectors',talent:'/talent',hires:'/hires',imports:'/me'}[view] + (['leave','tasks','accounts'].includes(view) ? `?limit=50&offset=${this.offset}` : ''));
      if (generation !== this.generation) return;
      this.root.replaceChildren();
      this[view](result);
    } catch (error) { if (generation === this.generation) this.root.replaceChildren(node('p', error.message, 'error')); }
  }
  heading(title, description) {
    this.root.append(node('h1', title), node('p', description, 'muted'));
  }
  form(title, fields, onSubmit) {
    const card = node('section', '', 'card'); card.append(node('h2', title));
    const form = node('form', '', 'module-form'); const controls = {};
    fields.forEach(spec => {
      const label = node('label', spec.label); const input = document.createElement(['select','person','account'].includes(spec.type) ? 'select' : 'input');
      input.name = spec.name; input.id = `f-${this.view}-${spec.name}-${Math.random().toString(36).slice(2,8)}`;
      label.htmlFor = input.id; input.required = !spec.optional;
      if (!['select','person','account'].includes(spec.type)) input.type = spec.type;
      if (spec.type === 'password') { input.autocomplete = spec.name === 'current_password' ? 'current-password' : 'new-password'; input.minLength = spec.name === 'current_password' ? 1 : 12; input.maxLength = 256; }
      if (spec.type === 'number') { input.step = spec.step || '1'; if (spec.min !== undefined) input.min = spec.min; }
      if (spec.type === 'text') input.maxLength = spec.max || 240;
      for (const option of spec.options || []) { const item = node('option', typeof option === 'string' ? option : option.label); item.value = typeof option === 'string' ? option : option.value; input.append(item); }
      if (spec.value !== undefined && spec.value !== null) input.value = spec.value;
      form.append(label);
      if (spec.type === 'person') {
        const search = node('input'); search.type = 'search'; search.placeholder = 'Find a person by name'; search.setAttribute('aria-label', 'Find a person');
        let request = 0; const populate = async () => {
          const serial = ++request;
          try {
            const page = await this.api.request('/people?' + new URLSearchParams({q:search.value,limit:50}));
            if (serial !== request) return;
            input.replaceChildren(node('option', 'Choose a person')); input.firstChild.value = '';
            for (const person of page.items.filter(p => p.status === 'active')) { const option = node('option', `${person.name} · ${person.email}`); option.value = person.id; input.append(option); }
          } catch (error) { input.replaceChildren(node('option', error.message)); input.firstChild.value = ''; }
        };
        search.oninput = populate; form.append(search); populate();
      }
      if (spec.type === 'account') {
        input.append(node('option','Choose an account')); input.firstChild.value='';
        let offset=0;
        const more=this.action('Load more accounts',async()=>{
          const page=await this.api.request(`/accounts?limit=100&offset=${offset}`);
          for(const account of page.items.filter(a=>a.active)) {
            const option=node('option',`${account.name} · ${account.email} · ${account.role}`); option.value=account.id; input.append(option);
          }
          offset+=100; more.hidden=page.items.length<100;
        });
        more.type='button'; form.append(more); more.click();
      }
      form.append(input); controls[spec.name] = input;
    });
    const error = node('p', '', 'error'); error.setAttribute('role','status');
    const button = node('button', 'Save'); button.type = 'submit'; form.append(error, button);
    form.onsubmit = async event => {
      event.preventDefault(); button.disabled = true; error.textContent = '';
      const values = Object.fromEntries(fields.map(spec => [spec.name, spec.type === 'number' && spec.step !== '.01' ? Number(controls[spec.name].value) : controls[spec.name].value]));
      try { await onSubmit(values); } catch (failure) { error.textContent = failure.message; }
      finally { button.disabled = false; }
    };
    card.append(form); return card;
  }
  action(label, action) {
    const button = node('button', label, 'secondary');
    button.onclick = async () => {
      button.disabled = true;
      try { await action(); } catch (error) { const message = node('p', error.message, 'error'); message.setAttribute('role','alert'); button.after(message); }
      finally { button.disabled = false; }
    }; return button;
  }
  list(items, render) {
    if (!items.length) this.root.append(node('p', 'No records yet.', 'empty-card'));
    items.forEach(item => this.root.append(render(item)));
    if (['leave','tasks','accounts'].includes(this.view)) {
      const pager = node('div','','pager');
      const prev = this.action('Previous', () => { this.offset -= 50; return this.show(this.view,false); }); prev.disabled = this.offset === 0;
      const next = this.action('Next', () => { this.offset += 50; return this.show(this.view,false); }); next.disabled = items.length < 50;
      pager.append(prev,node('span',`Page ${this.offset / 50 + 1}`),next); this.root.append(pager);
    }
  }
  profile(person) {
    this.heading('My profile', `${person.name} · ${person.email} · ${person.title || 'Role not set'}`);
    this.root.append(this.form('Preferred name', [field('preferred_name','Preferred name','text',{value:person.preferred_name, optional:true,max:120})], async values => {
      await this.api.request('/me/profile',{method:'PATCH',body:JSON.stringify({...values,version:person.version})}); await this.show('profile');
    }));
    if (this.current.password_login) this.root.append(this.form('Change password', [field('current_password','Current password','password'),field('new_password','New password (12+ characters)','password')], async values => {
      await this.api.request('/auth/password',{method:'POST',body:JSON.stringify(values)}); await this.onLogout();
    }));
  }
  leave(data) {
    this.heading('Time off', 'Request time off and follow its approval. Dates are inclusive calendar dates; no balance is deducted.');
    if (this.current.person_id) this.root.append(this.form('Request time off', [field('start_date','First day','date'),field('end_date','Last day','date'),field('kind','Type','select',{options:['annual','personal']}),field('note','Note (optional)','text',{optional:true,max:1000})], async values => {
      await this.api.request('/leave',{method:'POST',body:JSON.stringify(values)}); await this.show('leave');
    }));
    else this.root.append(node('p','Sign in with a named account to request or approve leave.','muted'));
    this.list(data.items, item => {
      const card=node('article','','card'); card.append(node('h2',`${item.name} · ${item.kind}`),node('p',`${item.start_date} → ${item.end_date}`),node('span',item.status,'badge'),node('p',item.note));
      const change = action => async () => { await this.api.request(`/leave/${item.id}/transition`,{method:'POST',body:JSON.stringify({action,version:item.version})}); await this.show('leave',false); };
      if (this.current.role==='admin' && this.current.person_id && this.current.person_id!==item.person_id && item.status==='requested') card.append(this.action('Approve',change('approve')),this.action('Reject',change('reject')));
      if (this.current.person_id===item.person_id && ['requested','approved'].includes(item.status)) card.append(this.action('Cancel request',change('cancel')));
      return card;
    });
  }
  tasks(data) {
    this.heading('Onboarding', 'Assign practical tasks and track completion. Employees see only their own tasks.');
    if (this.current.role==='admin') this.root.append(this.form('Assign a task',[field('person_id','Assign to','person'),field('title','Task'),field('due_date','Due date','date')],async values=>{
      await this.api.request('/tasks',{method:'POST',body:JSON.stringify(values)}); await this.show('tasks');
    }));
    this.list(data.items,item=>{
      const card=node('article','','card'); card.append(node('h2',item.title),node('p',`${item.name} · Due ${item.due_date}`),node('span',item.status,'badge'));
      card.append(this.action(item.status==='open'?'Mark done':'Reopen',async()=>{
        await this.api.request(`/tasks/${item.id}/transition`,{method:'POST',body:JSON.stringify({status:item.status==='open'?'done':'open',version:item.version})}); await this.show('tasks',false);
      })); return card;
    });
  }
  accounts(data) {
    this.heading('Accounts', 'Link each account to a person. Leave the password empty for SSO-only access, then link the account under Connectors. Otherwise share the initial password securely.');
    this.root.append(this.form('Create account',[field('person_id','Person','person'),field('role','Access','select',{options:['employee','admin']}),field('password','Initial password (optional for SSO-only)','password',{optional:true})],async values=>{
      await this.api.request('/accounts',{method:'POST',body:JSON.stringify({...values,password:values.password || null})}); await this.show('accounts');
    }));
    this.list(data.items,item=>{
      const card=node('article','','card'); card.append(node('h2',item.name),node('p',`${item.email} · ${item.role} · ${item.active?'Active':'Inactive'}`));
      if (item.id!==this.current.name) card.append(this.action(item.active?'Deactivate':'Reactivate',async()=>{
        await this.api.request(`/accounts/${item.id}/state`,{method:'PUT',body:JSON.stringify({active:!item.active})}); await this.show('accounts',false);
      })); return card;
    });
  }
  async employment(person) {
    this.view='employment'; this.root.replaceChildren(); this.heading('Employment record', person.name);
    try {
      const existing=await this.api.request(`/people/${person.id}/employment`);
      this.root.append(this.form('Employment dates and previous company',[field('hire_date','Hire date','date',{value:existing?.hire_date}),field('end_date','Last employed day (optional)','date',{value:existing?.end_date,optional:true}),field('previous_company','Previous company','text',{value:existing?.previous_company,optional:true,max:160})],async values=>{
        await this.api.request(`/people/${person.id}/employment`,{method:'PUT',body:JSON.stringify({...values,end_date:values.end_date||null,version:existing?.version||0})}); await this.employment(person);
      }));
    } catch(error) { this.root.append(node('p',error.message,'error')); }
  }
  insights(data) {
    this.heading('Workforce insights & planning', 'Calculated from your records. Missing dates remain visible; financial periods are never combined across currencies.');
    const metrics=node('div','','metric-grid');
    for(const [label,value] of [['Active people',data.active_headcount],['Average company tenure (years)',data.average_tenure_years ?? '—'],['Combined company tenure (years)',data.total_tenure_years ?? '—'],['Missing tenure records',data.missing_tenure_count]]) {
      const card=node('article','','card'); card.append(node('p',label,'eyebrow'),node('h2',String(value))); metrics.append(card);
    } this.root.append(metrics,node('p',`As of ${data.as_of} · Tenure sample: ${data.tenure_sample_size} people. Company tenure is not total career tenure.`,'muted'));
    const companies=node('section','','card'); companies.append(node('h2','Previous companies'));
    companies.append(node('p',data.previous_companies.length?data.previous_companies.map(item=>`${item.company}: ${item.people}`).join(' · '):'Add employment records from the People screen.')); this.root.append(companies);
    this.root.append(this.form('Add a financial period',[field('start_date','Period start','date'),field('end_date','Period end','date'),currency,field('revenue','Revenue','number',{step:'.01',min:0}),field('profit','Net profit (may be negative)','number',{step:'.01'})],async values=>{
      await this.api.request('/financial-periods',{method:'POST',body:JSON.stringify(values)}); await this.show('insights');
    }));
    for(const item of data.financial_periods) {
      const edit = node('details'); edit.append(node('summary','Edit financial period'));
      edit.append(this.form('Update financial period',[field('start_date','Period start','date',{value:item.start_date}),field('end_date','Period end','date',{value:item.end_date}),{...currency,value:item.currency},field('revenue','Revenue','number',{step:'.01',min:0,value:item.revenue}),field('profit','Net profit','number',{step:'.01',value:item.profit})],async values=>{
        await this.api.request(`/financial-periods/${item.id}`,{method:'PUT',body:JSON.stringify({...values,version:item.version})}); await this.show('insights');
      })); this.root.append(edit);
      const card=node('article','','card'); card.append(node('h2',`${item.start_date} → ${item.end_date} · ${item.currency}`),node('p',`Revenue ${item.revenue} · Net profit ${item.profit}`),node('p',`Revenue per employee: ${item.revenue_per_employee ?? 'Insufficient data'} · Profit per employee: ${item.profit_per_employee ?? 'Insufficient data'}`),node('p',`Average daily headcount: ${item.average_headcount ?? 'Unknown'} · Missing employment intervals: ${item.missing_employment_records}`,'muted')); this.root.append(card);
    }
    this.root.append(this.form('Create workforce plan',[field('name','Scenario name'),field('target_headcount','Target headcount','number',{min:0}),field('annual_cost_per_employee','Annual fully loaded cost per employee','number',{min:0,step:'.01'}),field('months','Months','number',{min:1,value:12}),currency],async values=>{
      await this.api.request('/plans',{method:'POST',body:JSON.stringify(values)}); await this.show('insights');
    }));
    for(const item of data.plans) {
      const edit = node('details'); edit.append(node('summary','Edit '+item.name));
      edit.append(this.form('Update workforce plan',[field('name','Scenario name','text',{value:item.name}),field('target_headcount','Target headcount','number',{min:0,value:item.target_headcount}),field('annual_cost_per_employee','Annual loaded cost per employee','number',{min:0,step:'.01',value:item.annual_cost_per_employee}),field('months','Months','number',{min:1,value:item.months}),{...currency,value:item.currency}],async values=>{
        await this.api.request(`/plans/${item.id}`,{method:'PUT',body:JSON.stringify({...values,version:item.version})}); await this.show('insights');
      })); this.root.append(edit);
      const card=node('article','','card'); card.append(node('h2',item.name),node('p',`${item.current_headcount} current → ${item.target_headcount} planned · ${item.months} months`),node('p',`Projected workforce cost: ${item.currency} ${item.projected_workforce_cost}`),node('p',item.assumption,'muted')); this.root.append(card); }
  }
  async ssoSettings() {
    const generation = this.generation;
    try {
      const data = await this.api.request('/sso');
      if (generation !== this.generation) return;
      const section = node('section','','card'); section.append(node('h2','Single sign-on'));
      const help = node('a','Setup instructions for Ashby, Workspace and SSO'); help.href='/static/integrations.html'; help.target='_blank'; help.rel='noopener'; section.append(help);
      if (!data.providers.length) section.append(node('p','Configure Google or Okta on the server to enable sign-in. Setup instructions explain the credentials and callback URL.','muted'));
      for (const provider of data.providers) section.append(node('p',`${provider.name} · Callback: ${provider.callback_url}`));
      for (const link of data.links) {
        const item=node('div'); item.append(node('p',`${link.name} · ${link.issuer} · ${link.subject}`));
        const provider=data.providers.find(p=>p.issuer===link.issuer);
        if(provider) item.append(this.action('Unlink and revoke sessions',async()=>{await this.api.request(`/sso/links/${provider.id}/${link.user_id}`,{method:'DELETE'});await this.show('connectors');}));
        section.append(item);
      }
      this.root.append(section);
      if (data.providers.length) {
        const form=this.form('Link an SSO identity',[field('provider','Identity provider','select',{options:data.providers.map(p=>p.id)}),field('user_id','Interface account','account'),field('subject','Provider user ID (subject; not email)', 'text',{max:255})],async values=>{
          await this.api.request('/sso/links',{method:'POST',body:JSON.stringify(values)}); await this.show('connectors');
        });
        form.append(node('p','For Google use the Workspace user ID; for Okta use the subject from your configured authorization server. Roles remain controlled by Interface.','muted'));
        this.root.append(form);
      }
    } catch(error) { if(generation===this.generation) this.root.append(node('p',error.message,'error')); }
  }
  connectors(data) {
    this.heading('Connectors', 'Connect supported services using server-side credentials. No credentials are sent to the browser.');
    for(const provider of data.providers) {
      const card=node('article','','card'); card.append(node('h2',provider.name),node('p',provider.description),node('p',provider.capabilities.join(' · '),'muted'));
      this.root.append(card);
    }
    this.root.append(this.form('Add connection',[field('name','Connection name'),field('provider','Provider','select',{options:data.providers.map(p=>p.id)}),field('secret_env','Server environment variable containing the credentials')],async values=>{
      await this.api.request('/connectors',{method:'POST',body:JSON.stringify(values)}); await this.show('connectors');
    }));
    for(const connection of data.connections) {
      const card=node('article','','card'); card.append(node('h2',connection.name),node('p',`${connection.provider} · ${connection.status}`),node('p',connection.message || 'Not tested yet.','muted'));
      card.append(this.action('Test connection',async()=>{await this.api.request(`/connectors/${connection.id}/test`,{method:'POST'});await this.show('connectors');}));
      if(['greenhouse','ashby','ashby_hires','google_workspace'].includes(connection.provider)) card.append(this.action(connection.next_page ? 'Sync next page' : 'Start refresh',async()=>{await this.api.request(`/connectors/${connection.id}/${connection.next_page ? 'sync' : 'restart'}`,{method:'POST'});await this.show('connectors');}));
      this.root.append(card);
    }
    if(data.workspace_users?.length) { this.root.append(node('h2','Workspace directory (first 100 by name)')); for(const item of data.workspace_users) this.root.append(node('p',`${item.name} · ${item.email} · ${item.suspended ? 'Suspended' : 'Active'} · ID ${item.external_id}`)); }
    this.ssoSettings();
    if(data.candidates?.length) { this.root.append(node('h2','Imported candidates (first 100 by name)')); for(const item of data.candidates) this.root.append(node('p',`${item.name} · ${item.email || 'No email'} · ${item.provider}`)); }
  }
}
