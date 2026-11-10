import json
D='/private/tmp/claude-501/-Users-shakhzoduralov--claude-spares-spare-3xH9lN/3abbc986-6d98-4d1a-bb5b-f0ab8efba645/scratchpad/web-site/docs/site/design'
jobs=[]
# the shot script navigates with file:// + path; query passed via src
for name in ['home','tool','pricing','ai-service','legal']:
  for w,h in [(1440,900),(390,844)]:
    for th in ['light','dark']:
      jobs.append({'src':f'{D}/mockups/{name}.html','q':f'?shot=1&theme={th}','out':f'{D}/screenshots/{name}-{w}-{th}.png','w':w,'h':h,'full':True,'check':True})
for w,h in [(1440,900),(390,844)]:
  jobs.append({'src':f'{D}/mockups/home.html','q':'?shot=1&lang=uz','out':f'{D}/screenshots/home-{w}-light-uz.png','w':w,'h':h,'full':False,'check':True})
jobs.append({'src':f'{D}/mockups/home.html','q':'?shot=1&lang=ru','out':f'{D}/screenshots/home-390-light-ru.png','w':390,'h':844,'full':False,'check':True})
jobs.append({'src':f'{D}/mockups/tool.html','q':'?shot=1&menu=tools','out':f'{D}/screenshots/tool-1440-light-megamenu.png','w':1440,'h':900,'full':False})
jobs.append({'src':f'{D}/mockups/home.html','q':'?shot=1&menu=mobile&theme=dark','out':f'{D}/screenshots/home-390-dark-menu.png','w':390,'h':844,'full':False})
jobs.append({'src':f'{D}/brand/concepts.html','q':'','out':f'{D}/screenshots/brand-concepts-1440.png','w':1440,'h':900,'full':True})
json.dump(jobs,open('j4.json','w'))
