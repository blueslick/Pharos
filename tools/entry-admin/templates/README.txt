EDITING THE EMAIL TEMPLATES
---------------------------
These are plain text files. Change the wording however you like, then run `emails` again
with --all to remake drafts.

Only three kinds of email are drafted: received, confirmed and payment_not_found.
Entrants who break a rule are disqualified and are not emailed. Only payment problems get an email.

Words in {curly brackets} are filled in automatically for each entrant:
  {first_name}  {name}  {entry_id}  {email}
  {site_name}  {edition}  {contact_email}  {soup_kitchen}  {sign_off}   (set in config.toml)
  {fee_myr}  {payment_fix_by}   (set in config.toml: the RM 40 transfer and the date it must be found by)
  {word_limit}  {words}  {open_max_age}
  {problems}    (payment_not_found.txt only: the list of payment problems with that entry)

If you want a real curly bracket in the text, type it twice: {{ or }}.
Square brackets like [deadline] are NOT filled in: they are reminders for you to type the
real thing in once you know it.

flag_messages.toml holds the sentence used for each payment flag in the payment_not_found email.
