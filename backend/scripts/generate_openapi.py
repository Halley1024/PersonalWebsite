import sys
if sys.argv[1:] not in ([],['--check']): raise SystemExit('用法：generate_openapi.py [--check]')
def emit(path,text):
    if '--check' in sys.argv:
        assert path.exists() and path.read_text()==text, f'{path.name} 已过期，请重新生成'
    else:
        path.write_text(text)
import json,copy
from pathlib import Path
S={}
def ref(name): return {'$ref':f'#/components/schemas/{name}'}
def string(maximum=None,**extra): return {'type':'string',**({'maxLength':maximum} if maximum else {}),**extra}
def nullable(schema): return {'anyOf':[schema,{'type':'null'}]}
def array(item,maximum=None): return {'type':'array','items':item,**({'maxItems':maximum} if maximum else {})}
def obj(properties,required=None,strict=True): return {'type':'object','properties':properties,'required':list(properties) if required is None else required,**({'additionalProperties':False} if strict else {})}
uuid=string(format='uuid'); instant=string(format='date-time'); date=string(format='date'); integer={'type':'integer','format':'int32'};boolean={'type':'boolean'};version={**integer,'minimum':1}
S['Error']=obj({'error':obj({'code':string(),'message':string(),'fields':{'type':'object','additionalProperties':string()},'request_id':uuid})})
S['MediaSummary']=obj({'id':uuid,'url':string(),'width':integer,'height':integer,'alt':string(200)})
S['TaxonomySummary']=obj({'id':uuid,'name':string(50),'slug':string(100)})
S['Stats']=obj({x:string(20) for x in ['experience','projects','notes']})
S['SocialLink']=obj({'label':string(40,minLength=1),'url':string(2048,format='uri')})
S['SkillGroup']=obj({'title':string(50,minLength=1),'items':array(string(50,minLength=1),20)})
S['Experience']=obj({'id':uuid,'title':string(100,minLength=1),'organization':string(120),'start_date':string(pattern=r'^[0-9]{4}-(0[1-9]|1[0-2])$'),'end_date':nullable(string(pattern=r'^[0-9]{4}-(0[1-9]|1[0-2])$')),'description':string(1000)})
profile={'display_name':string(80,minLength=1),'headline':string(160),'intro':string(300),'stats':ref('Stats'),'bio_markdown':string(20000),'avatar_media_id':nullable(uuid),'location_label':nullable(string(100)),'public_email':nullable(string(254,format='email')),'social_links':array(ref('SocialLink'),10),'skill_groups':array(ref('SkillGroup'),10),'experiences':array(ref('Experience'),30)}
S['ProfileUpdate']=obj({**profile,'version':version});public={k:v for k,v in profile.items() if k!='avatar_media_id'};public['avatar']=nullable(ref('MediaSummary'));S['PublicProfile']=obj(public)
S['AdminProfile']=obj({**profile,'avatar':nullable(ref('MediaSummary')),'version':version,'updated_at':instant})
settings={'site_name':string(80,minLength=1),'site_description':string(300),'footer_text':string(300),'default_seo_title':nullable(string(70,minLength=1)),'default_seo_description':nullable(string(160,minLength=1))}
S['Settings']=obj(settings);S['SettingsUpdate']=obj({**settings,'version':version});S['AdminSettings']=obj({**settings,'version':version,'updated_at':instant})
S['AdminIdentity']=obj({'id':uuid,'username':string(64)})
S['LoginInput']=obj({'username':string(64,minLength=1),'password':string(128,minLength=1)})
S['LoginResult']=obj({'admin':ref('AdminIdentity'),'csrf_token':string(),'expires_at':instant})
S['Session']= {'oneOf':[obj({'authenticated':{'type':'boolean','enum':[False]}}),obj({'authenticated':{'type':'boolean','enum':[True]},'admin':ref('AdminIdentity'),'csrf_token':string(),'expires_at':instant})]}
S['PasswordInput']=obj({'current_password':string(128,minLength=1),'new_password':string(128,minLength=12)})
S['Project']=obj({'tech_stack':array(string(50,minLength=1),20),'project_stage':string(enum=['idea','building','maintained','completed']),'started_on':date,'ended_on':nullable(date),'repository_url':nullable(string(2048,format='uri')),'demo_url':nullable(string(2048,format='uri'))})
S['Life']=obj({'occurred_on':date,'location_label':nullable(string(100))})
S['GalleryInput']=obj({'media_id':uuid,'alt':string(200),'position':{**integer,'minimum':0}})
S['GalleryItem']=obj({'media':ref('MediaSummary'),'alt':string(200),'position':{**integer,'minimum':0}})
fields={'title':string(120,minLength=1),'excerpt':string(300,minLength=1),'body_markdown':string(200000),'cover_media_id':nullable(uuid),'category_id':nullable(uuid),'tag_ids':{**array(uuid,10),'uniqueItems':True},'featured':boolean,'sort_order':integer,'seo_title':nullable(string(70,minLength=1)),'seo_description':nullable(string(160,minLength=1)),'gallery':array(ref('GalleryInput'),20),'project':nullable(ref('Project')),'life':nullable(ref('Life'))}
S['CreateContent']=obj({**fields,'kind':string(enum=['blog','project','life']),'slug':string(100,pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$')})
S['UpdateContent']=obj({**fields,'version':version});S['ChangeStatus']=obj({'status':string(enum=['draft','published','archived']),'version':version})
base={'id':uuid,'kind':string(enum=['blog','project','life']),'slug':string(100),'title':string(120),'excerpt':string(300),'cover':nullable(ref('MediaSummary')),'category':nullable(ref('TaxonomySummary')),'tags':array(ref('TaxonomySummary')),'featured':boolean,'published_at':instant,'updated_at':instant}
# 卡片按 kind 有不同附加字段；实际字段差异在开发文档 10 中说明。
S['PublicCard']=obj({**base,'tech_stack':array(string()),'project_stage':string(),'started_on':date,'ended_on':nullable(date),'occurred_on':date,'location_label':nullable(string(100))},required=list(base))
S['PublicDetail']=obj({**S['PublicCard']['properties'],'body_markdown':string(200000),'seo_title':nullable(string(70)),'seo_description':nullable(string(160)),'gallery':array(ref('GalleryItem')),'project':nullable(ref('Project')),'life':nullable(ref('Life'))},required=[*base,'body_markdown','seo_title','seo_description','gallery','project','life'])
S['AdminCard']=obj({**base,'published_at':nullable(instant),'status':string(enum=['draft','published','archived']),'version':version,'created_at':instant,'sort_order':integer,'project':nullable(ref('Project')),'life':nullable(ref('Life'))})
S['AdminDetail']=obj({**S['AdminCard']['properties'],**fields,'tag_ids':array(uuid,10),'gallery':array({**S['GalleryInput'],'properties':{**S['GalleryInput']['properties'],'media':nullable(ref('MediaSummary'))}})})
for tag in ['Category','Tag']:
    attrs={'kind':string(enum=['blog','project','life']),'name':string(50,minLength=1),'slug':string(100,pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$')}
    if tag=='Category':attrs['sort_order']=integer
    S[tag+'Create']=obj(attrs);S[tag+'Update']=obj({k:v for k,v in attrs.items() if k!='kind'}|{'version':version});S[tag]=obj(attrs|{'id':uuid,'version':version,'created_at':instant,'updated_at':instant})
S['Media']=obj({**S['MediaSummary']['properties'],'thumbnail_url':string(),'mime_type':string(enum=['image/jpeg','image/png','image/webp']),'byte_size':{'type':'integer','format':'int64'},'created_at':instant,'reference_count':{'type':'integer','minimum':0}})
S['Pageview']=obj({'event_id':uuid,'page_path':string(300,minLength=1),'referrer_origin':nullable(string(255,format='uri'))})
S['Region']=obj({'id':string(),'label':string(),'blockable':boolean})
rule={'scope':string(enum=['ip','region']),'ip':nullable(string()),'region_id':nullable(string()),'reason':string(200,minLength=1),'enabled':boolean,'duration_hours':{'type':['integer','null'],'enum':[1,24,168,None]}}
S['RuleCreate']=obj(rule);S['RuleUpdate']=obj(rule|{'version':version})
S['AccessRule']=obj({'id':uuid,'scope':rule['scope'],'target':string(),'target_label':string(),'action':string(enum=['deny']),'reason':rule['reason'],'enabled':boolean,'duration_hours':rule['duration_hours'],'created_at':instant,'updated_at':instant,'expires_at':nullable(instant),'version':version,'effective':boolean})
S['Visit']=obj({'id':uuid,'occurred_at':instant,'ip':string(),'region_id':string(),'region_label':string(),'network_label':nullable(string()),'page_path':string(),'page_title':string(),'content_id':nullable(uuid),'source':string(enum=['direct','github','search','bilibili','other']),'device':string(enum=['desktop','mobile','tablet','unknown']),'matched_rule_ids':array(uuid)})
S['Analytics']=obj({'timezone':string(enum=['Asia/Shanghai']),'start_date':date,'end_date':date,'pv':{'type':'integer'},'uv':{'type':'integer'},'pv_change_percent':{'type':['number','null']},'uv_change_percent':{'type':['number','null']},'average_duration_seconds':{'type':['number','null'],'description':'首期始终为 null'},'series':array(obj({'date':date,'pv':{'type':'integer'},'uv':{'type':'integer'}})),'sources':array(obj({'source':string(),'pv':{'type':'integer'}})),'devices':array(obj({'device':string(),'pv':{'type':'integer'}})),'popular_contents':array(obj({'content_id':uuid,'kind':string(),'slug':string(),'title':string(),'pv':{'type':'integer'}}))})
S['Dashboard']=obj({'counts':array(obj({'kind':string(),'status':string(),'count':{'type':'integer'}})),'recent_contents':array(ref('AdminCard'))})
S['Meta']=obj({k:{'type':'integer'} for k in ['page','page_size','total','total_pages']})
paths={}
def param(name,schema,where='query',required=False):return {'name':name,'in':where,'required':required or where=='path','schema':schema}
def operation(path,method,summary,response=None,input=None,page=False,params=None):
    admin='/admin/' in path;protected=admin or path.endswith('/auth/logout');write=method in ['post','put','delete'];status='201' if method=='post' and admin and not path.endswith('/status') else '204' if method=='delete' or path.endswith('/auth/logout') or path.endswith('/admin/password') or path.endswith('/pageviews') else '200'
    op={'summary':summary,'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}','').replace('-','_'),'security':[{'AdminCookie':[]}] if protected else [],'parameters':list(params or []),'responses':{}}
    for segment in path.split('/'):
        if segment.startswith('{'):op['parameters'].append(param(segment[1:-1],uuid if segment=='{id}' else string(100),'path'))
    if write and (protected or path.endswith('/auth/login') or path.endswith('/pageviews')):op['parameters'].append(param('Origin',string(),'header',True))
    if write and protected:op['parameters'].append(param('X-CSRF-Token',string(),'header',True))
    if input:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(input)}}}
    success={'description':'成功','headers':{'X-Request-Id':{'schema':uuid},'Cache-Control':{'schema':string(enum=['no-store'])}}}
    if response:
        shape=obj({'data':array(ref(response)),'meta':ref('Meta')}) if page else obj({'data':ref(response)})
        success['content']={'application/json':{'schema':shape}}
    if status=='201':success['headers']['Location']={'schema':string()}
    if path.endswith('/auth/login') or path.endswith('/pageviews') or path.endswith('/auth/logout') or path.endswith('/admin/password'):success['headers']['Set-Cookie']={'schema':string()}
    op['responses'][status]=success
    for e in [400,401,403,404,409,413,415,422,429,500,503]:op['responses'][str(e)]={'description':'统一错误响应','content':{'application/json':{'schema':ref('Error')}}}
    paths.setdefault(path,{})[method]=op
    return op
paging=[param('page',{'type':'integer','minimum':1}),param('page_size',{'type':'integer','minimum':1,'maximum':50})]
for resource,typename in [('profile','Profile'),('settings','Settings')]:
    operation('/api/v1/'+resource,'get','公开查询'+resource,'PublicProfile' if resource=='profile' else 'Settings')
    operation('/api/v1/admin/'+resource,'get','管理查询'+resource,'Admin'+typename)
    operation('/api/v1/admin/'+resource,'put','完整更新'+resource,'Admin'+typename,typename+'Update')
operation('/api/v1/auth/login','post','管理员登录','LoginResult','LoginInput');operation('/api/v1/auth/session','get','当前会话','Session');operation('/api/v1/auth/logout','post','退出当前会话');operation('/api/v1/admin/password','put','修改密码并撤销所有会话',input='PasswordInput')
for route in ['posts','projects','life']:
    operation('/api/v1/'+route,'get','公开已发布内容列表','PublicCard',page=True,params=paging+[param('q',string(100)),param('category',string(100)),param('tag',string(100)),param('featured',boolean)])
    operation('/api/v1/'+route+'/{slug}','get','公开已发布内容详情','PublicDetail')
operation('/api/v1/admin/contents','get','管理内容列表','AdminCard',page=True,params=paging+[param('kind',string(enum=['blog','project','life'])),param('status',string(enum=['draft','published','archived'])),param('q',string(100)),param('category',string(100)),param('tag',string(100)),param('sort',string(enum=['updated_desc','created_desc','sort_asc']))])
operation('/api/v1/admin/contents','post','创建草稿','AdminDetail','CreateContent');operation('/api/v1/admin/contents/{id}','get','管理内容详情','AdminDetail');operation('/api/v1/admin/contents/{id}','put','完整保存内容','AdminDetail','UpdateContent');operation('/api/v1/admin/contents/{id}','delete','删除草稿或归档内容',params=[param('version',version,required=True)]);operation('/api/v1/admin/contents/{id}/status','post','发布、下线、归档或恢复','AdminDetail','ChangeStatus')
for route,typ in [('categories','Category'),('tags','Tag')]:
    op=operation('/api/v1/'+route,'get','公开已发布引用的分类或标签',params=[param('kind',string(enum=['blog','project','life']),required=True)]);op['responses']['200']['content']={'application/json':{'schema':obj({'data':array(ref('TaxonomySummary'))})}}
    operation('/api/v1/admin/'+route,'get','管理分类或标签列表',typ,page=True,params=[param('kind',string(enum=['blog','project','life'])),param('page',{'type':'integer','minimum':1}),param('page_size',{'type':'integer','minimum':1,'maximum':100})]);operation('/api/v1/admin/'+route,'post','创建分类或标签',typ,typ+'Create');operation('/api/v1/admin/'+route+'/{id}','put','更新分类或标签',typ,typ+'Update');operation('/api/v1/admin/'+route+'/{id}','delete','删除未引用分类或标签',params=[param('version',version,required=True)])
op=operation('/api/v1/media/{id}','get','读取当前有权访问的图片',params=[param('variant',string(enum=['original','thumb']))]);op['responses']['200']['content']={'image/webp':{'schema':string(format='binary')},'image/png':{'schema':string(format='binary')},'image/jpeg':{'schema':string(format='binary')}}
operation('/api/v1/admin/media','get','管理媒体列表','Media',page=True,params=paging+[param('unused',boolean)])
op=operation('/api/v1/admin/media','post','上传并重编码一张图片','Media');op['requestBody']={'required':True,'content':{'multipart/form-data':{'schema':obj({'file':string(format='binary',description='JPEG/PNG/WebP，最大 10 MiB'),'alt':string(200)},required=['file'])}}}
operation('/api/v1/admin/media/{id}','delete','删除未引用媒体')
operation('/api/v1/admin/dashboard','get','内容数量与最近更新','Dashboard')
operation('/api/v1/analytics/pageviews','post','记录幂等页面浏览',input='Pageview')
operation('/api/v1/admin/analytics','get','7/30 天真实流量统计','Analytics',params=[param('days',{'type':'integer','enum':[7,30]})])
operation('/api/v1/admin/visits','get','访问明细','Visit',page=True,params=paging+[param('start_date',date),param('end_date',date),param('q',string(100)),param('source',string(enum=['direct','github','search','bilibili','other'])),param('region_id',string())])
op=operation('/api/v1/admin/regions','get','规范区域目录');op['responses']['200']['content']={'application/json':{'schema':obj({'data':array(ref('Region'))})}}
operation('/api/v1/admin/access-rules','get','封锁规则列表','AccessRule',page=True,params=paging+[param('scope',string(enum=['ip','region'])),param('state',string(enum=['active','expired','disabled'])),param('q',string(100))]);operation('/api/v1/admin/access-rules','post','创建封锁规则','AccessRule','RuleCreate');operation('/api/v1/admin/access-rules/{id}','put','更新或禁用封锁规则','AccessRule','RuleUpdate');operation('/api/v1/admin/access-rules/{id}','delete','删除封锁规则',params=[param('version',version,required=True)])
for name in ['live','ready']:
    paths['/health/'+name]={'get':{'summary':'存活检查' if name=='live' else '数据库与迁移就绪检查','security':[],'responses':{'200':{'description':'正常','content':{'application/json':{'schema':obj({'status':string(enum=['ok'])})}}},**({'503':{'description':'未就绪','content':{'application/json':{'schema':obj({'status':string(enum=['not_ready'])})}}}} if name=='ready' else {})}}}
paths['/internal/access-check']={'get':{'summary':'仅可信代理可调用的公开访问检查','security':[],'responses':{'204':{'description':'放行'},'403':{'description':'拒绝'},'404':{'description':'非可信代理不可访问'},'503':{'description':'依赖故障'}}}}
paths['/sitemap.xml']={'get':{'summary':'已发布内容站点地图','security':[],'responses':{'200':{'description':'XML','content':{'application/xml':{'schema':string()}}}}}}
doc={'openapi':'3.1.0','info':{'title':'PersonalWebsite Rust API','version':'1.0.0','description':'Cookie Session；公开查询与管理写入分离。经历月份字段使用 start_date/end_date，值为 YYYY-MM。'},'servers':[{'url':'http://127.0.0.1:8080'}],'paths':paths,'components':{'securitySchemes':{'AdminCookie':{'type':'apiKey','in':'cookie','name':'admin_session_dev','description':'生产名称为 __Host-admin_session，使用 Secure/HttpOnly/SameSite=Lax'}},'schemas':S}}
emit(Path(__file__).resolve().parents[1].joinpath('openapi.json'), json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
# 验证所有本地 schema 引用，防止文档中出现悬空类型。
def check(value):
    if isinstance(value,dict):
        if '$ref' in value: assert value['$ref'].split('/')[-1] in S,value
        for v in value.values():check(v)
    elif isinstance(value,list):
        for v in value:check(v)
check(doc)
print('OpenAPI:',len(paths),'条路径，',sum(len(v) for v in paths.values()),'个操作，',len(S),'个数据结构')

# 校验文档路径及方法与实际 Axum 路由一致，防止新增接口时漏更新契约。
import re
actual=set()
for file in (Path(__file__).resolve().parents[1]/'src/routes').glob('*.rs'):
    code=file.read_text()
    for match in re.finditer(r'\.route\(\s*"([^"\n]+)"',code):
        path=match.group(1)
        if file.stem in ['public','admin','auth','media','analytics']:path='/api/v1'+path
        start=match.end();depth=1;end=start
        while end<len(code) and depth:
            if code[end]=='(':depth+=1
            elif code[end]==')':depth-=1
            end+=1
        for method in re.findall(r'\b(get|post|put|delete|patch)\(',code[start:end]):actual.add((path,method))
expected={(path,method) for path,ops in paths.items() for method in ops}
assert actual==expected, {'undocumented':sorted(actual-expected),'unimplemented':sorted(expected-actual)}

def ts(schema):
    if '$ref' in schema:return schema['$ref'].split('/')[-1]
    if 'enum' in schema:return ' | '.join(json.dumps(x,ensure_ascii=False) for x in schema['enum'])
    if 'oneOf' in schema:return ' | '.join(ts(x) for x in schema['oneOf'])
    if 'anyOf' in schema:return ' | '.join(ts(x) for x in schema['anyOf'])
    if 'allOf' in schema:return ' & '.join(ts(x) for x in schema['allOf'])
    if schema.get('format')=='binary':return 'Blob'
    kind=schema.get('type')
    if isinstance(kind,list):return ' | '.join(ts(dict(schema,type=x)) for x in kind)
    if kind=='array':return '('+ts(schema['items'])+')[]'
    if kind=='object':
        props=schema.get('properties',{});required=schema.get('required',[])
        if not props and isinstance(schema.get('additionalProperties'),dict):return 'Record<string, '+ts(schema['additionalProperties'])+'>'
        return '{ '+ '; '.join(json.dumps(k)+('' if k in required else '?')+': '+ts(v) for k,v in props.items())+' }'
    return {'integer':'number','number':'number','string':'string','boolean':'boolean','null':'null'}.get(kind,'unknown')
lines=['// 由 scripts/generate_openapi.py 从同一契约源生成，请勿手工修改。']
for name,schema in S.items():lines.append('export type '+name+' = '+ts(schema)+';')
lines.append('export interface ApiOperations {')
for path,ops in paths.items():
    for method,op in ops.items():
        key=method.upper()+' '+path
        request=next(iter(op.get('requestBody',{}).get('content',{}).values()),{}).get('schema')
        response=next((v for k,v in op['responses'].items() if k.startswith('2')),{}).get('content',{})
        schema=response.get('application/json',{}).get('schema')
        result=ts(schema) if schema else ('Uint8Array' if any(k.startswith('image/') for k in response) else 'string' if 'application/xml' in response else 'undefined')
        lines.append('  '+json.dumps(key)+': { request: '+(ts(request) if request else 'undefined')+'; response: '+result+' };')
lines.append('}')
emit(Path(__file__).resolve().parents[1].joinpath('docs/api-types.ts'), '\n'.join(lines)+'\n')
print('实际路由与 OpenAPI 一致；TypeScript 数据类型已生成。')
