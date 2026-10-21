from playwright.sync_api import sync_playwright
import json, os, shutil
base=os.environ.get('SITE_URL', 'http://127.0.0.1:8080/claynest_whispers/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for w in [360,390,768,1440]:
  page.set_viewport_size({'width':w,'height':900})
  for name in ['index','gallery','about','contact']:
   r=page.goto(base+name+'.html',wait_until='domcontentloaded');page.wait_for_timeout(250)
   assert r.status==200
   dims=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert dims['scroll']<=w, (name,w,dims)
   assert page.locator('h1').count()==1
   assert page.locator('#site-navigation [aria-current="page"]').count()==1
   if w==390:page.screenshot(path='/tmp/clay-'+name+'-mobile.png',full_page=True)
   if w==1440:page.screenshot(path='/tmp/clay-'+name+'-desktop.png',full_page=True)
  print('pages and overflow',w,'PASS')
 page.set_viewport_size({'width':390,'height':900});page.goto(base+'index.html')
 page.locator('.menu-toggle').click();assert page.locator('#site-navigation').is_visible();page.keyboard.press('Escape');assert not page.locator('#site-navigation').is_visible()
 page.locator('.menu-toggle').click();page.locator('#site-navigation a[href="gallery.html"]').click();assert page.url.endswith('gallery.html')
 print('mobile navigation PASS')
 for pill in page.locator('.filter-pill').all():
  cat=pill.get_attribute('data-filter');pill.click()
  for card in page.locator('.artwork-card').all():assert card.is_visible()==(cat=='all' or cat in card.get_attribute('data-category').split())
 page.locator('.filter-pill[data-filter="all"]').click()
 for card in page.locator('.artwork-card').all():
  title=card.get_attribute('data-title');card.focus();page.keyboard.press('Enter')
  assert page.locator('#artwork-modal').is_visible();assert page.locator('#modal-title').text_content()==title
  assert page.locator('#modal-image').get_attribute('src')==card.get_attribute('data-img')
  assert page.evaluate('document.body.style.overflow')=='hidden'
  assert page.locator('#modal-inquire-btn').get_attribute('href').startswith('contact.html?artwork=')
  page.keyboard.press('Shift+Tab');assert page.locator('#modal-inquire-btn').evaluate('(e)=>e===document.activeElement')
  page.keyboard.press('Tab');assert page.locator('[data-close-modal]').evaluate('(e)=>e===document.activeElement')
  page.keyboard.press('Escape');assert not page.locator('#artwork-modal').is_visible();assert card.evaluate('(e)=>e===document.activeElement')
  assert page.evaluate('document.body.style.overflow')==''
 page.locator('.artwork-card').first.click();page.locator('[data-close-modal]').click();assert not page.locator('#artwork-modal').is_visible()
 page.locator('.artwork-card').first.click();page.locator('#artwork-modal').click(position={'x':2,'y':2});assert not page.locator('#artwork-modal').is_visible()
 page.locator('.artwork-card').first.click();title=page.locator('#modal-title').text_content();page.locator('#modal-inquire-btn').click();assert page.locator('#artwork').input_value()==title
 print('filters, all four dialogs, focus trap, Escape, backdrop, enquiry PASS')
 page.locator('#submit-btn').click();assert page.locator('#name:invalid').count()==1
 for field,value in [('name','Δοκιμή'),('email','test@example.com'),('message','Δοκιμαστικό μήνυμα χωρίς πραγματική αποστολή.')]:page.locator('#'+field).fill(value)
 calls=[];page.on('request',lambda r:calls.append(r.url) if 'formspree.io/f/' in r.url else None)
 page.locator('#submit-btn').click();assert 'δεν έχει ακόμη ενεργοποιηθεί' in page.locator('#form-status').inner_text();assert not calls
 print('native validation and placeholder blocking PASS')
 # Simulated responses only; every Formspree request is intercepted.
 for outcome in ['success','error','network']:
  page.route('**/assets/config.js',lambda route:route.fulfill(content_type='application/javascript',body="window.CLAYNEST_CONFIG={formspreeEndpoint:'https://formspree.io/f/testid'}"))
  page.goto(base+'contact.html')
  def respond(route):
   if outcome=='network':route.abort()
   else:route.fulfill(status=200 if outcome=='success' else 422,content_type='application/json',body=json.dumps({'ok':True} if outcome=='success' else {'errors':[{'message':'Invalid'}]}))
  page.route('https://formspree.io/f/testid',respond)
  for field,value in [('name','Δοκιμή'),('email','test@example.com'),('message','Δοκιμαστικό μήνυμα χωρίς πραγματική αποστολή.')]:page.locator('#'+field).fill(value)
  page.locator('#submit-btn').click();page.wait_for_function("!document.querySelector('#contact-form').hasAttribute('aria-busy')")
  status=page.locator('#form-status').inner_text()
  assert ('στάλθηκε επιτυχώς' in status)==(outcome=='success'),(outcome,status)
  assert (page.locator('#message').input_value()=='')==(outcome=='success')
  print('mock form',outcome,'PASS');page.unroute('https://formspree.io/f/testid')
 # Delay an intercepted request to exercise the pending UI and duplicate guard.
 page.goto(base+'contact.html')
 for field,value in [('name','Δοκιμή'),('email','test@example.com'),('message','Μήνυμα δοκιμής φόρτωσης.')]:page.locator('#'+field).fill(value)
 intercepted=[]
 page.route('https://formspree.io/f/testid',lambda route:intercepted.append(route))
 page.locator('#submit-btn').click();page.wait_for_timeout(100)
 assert page.locator('#submit-btn').is_disabled()
 assert page.locator('#contact-form').get_attribute('aria-busy')=='true'
 assert 'Αποστολή' in page.locator('#form-status').inner_text()
 page.locator('#contact-form').evaluate('(f)=>f.requestSubmit()');page.wait_for_timeout(100)
 assert len(intercepted)==1
 intercepted[0].fulfill(status=200,content_type='application/json',body='{"ok":true}')
 page.wait_for_function("!document.querySelector('#submit-btn').disabled")
 print('loading state and duplicate-submission guard PASS')
 assert not errors,errors
 print('JavaScript errors:',errors)
 b.close()
