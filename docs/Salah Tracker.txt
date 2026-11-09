Salah Tracker 



Application - Feature build or need To change 

1-have 4 types of files 

 - summary file 1- per user 
    - this file have user name, its profile pic link, gender , school of thought, user location 
    - Total fraz, total sunnnah muqada ,  total nawafil, total farz on time , total nawafil on time, highest streak per namaz and 5 namaz ,  5 namaz with sunnat muqada
    - total qaza, total qaza offered, total prayer mark with oath or without oath 
    - current streaks, total mark on time

 - per-day-Record  1- per user 
    - per-day-Record store its id in local storage so use do not have to search again and again 
    have json of 
      "date": "file-id"
   so that we can find file per day in O(1)
  
 - "date.json" 1 - per day
   - for each prayer record actual time range , + user offer that day (user actually click)
   - if user click all once just record when the user mark it 
   - user can mark only today prayers not old 
   - show warning in Islamic way when user mark the namaz take the oath make the witness of god they really offer the prayer, 2 both option without
     oauth and with oauth  record the user response user mark it with oauth or without oauth 
   - each prayer have all this record show option off all the sunnah muqada , witr with respective prayer 
   - user have othe nawafil option where user can decide his nawafil with his will
   - if the user mark the prayer on the time the prayer  the prayer time is matched with its time we fetch through api then mark is on time, its an internall detail if user mark all prayer on same time we show ok and show on time but in future for our leadership board we will include this detail user actuall mark on time or not this feature hide from the user. 
   
   -"Qaza balance": 1 - per user 
      - create a qaza balance file have record of complete qaza prayer offered
      - User opens Qaza dashboard 
      - User opens Qaza history - Only then retrieve the relevant daily records through the daily index.
   - Qaza records –1 - yearly 


Qaza and Rules:
   - Application only track qaza farz prayer not other any type 
   - show user the 2-3 qaza prayer 
   - when user mark it take outh or without oath and mark it into repective date file you can find the file in O(1) think accrodingly

Other Desgin decisions 
   - things fetch once does not refectuch atleast for one day user local chache to store 
   - use chache so that reduce the no of request to google drive so more people can use the application
   - reterival should fast.
   - include the privacy polcy pages so that we can publish our google console app 

Recommended pages for data privcy and application publish
1. Privacy Policy
2. Terms of Service
3. Account Deletion
4. Data Collection & Usage
5. Contact / Support

Additional improvements:
- Use batch requests where supported.
- Avoid fetching every historical daily file.
- Write only changed records.
- Use optimistic UI updates with rollback if saving fails.
- Use ETag/version checks to prevent overwriting newer data.
- Add retry with exponential backoff.
- Queue writes when internet is unavailable.



data save 
 - if the user mark the prayer and click the sync it will not update so show warning to user 
 - user other nawafil can only mark sync once, store it in the local storage and mark them at the next day if no sync is left for today for nawfil 
 - so total 5+1 sync to update user can sync any prayer  until 5 sync complete once 5 sync complete it will not change the file, if the prayer time goes remove the 1 sync fixed it with the prayer timing 
- isha prayer time remains next day before fajar time so adjust accrdonliy
- we have limited quota for google console application so use accrodlinly
   