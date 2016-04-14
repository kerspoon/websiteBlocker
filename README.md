
# A chrome extension that allow me to do what I want with blocking pages

**see**

- http://superuser.com/questions/284110/redirect-urls-in-chrome
- http://stackoverflow.com/questions/4859689/how-do-i-redirect-to-a-url-using-a-google-chrome-extension-content-script

## what I want

- redirect <days> <fromTime> <toTime> <from url regex> <to url regex (default "about:blank")>

**example**

- redirect all 0000 2400 "^facebook.com" "facebook.com/messages"
- redirect "mon,tue,wed" 13:40 23:00 "^facebook.com"
