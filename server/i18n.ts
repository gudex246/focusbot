export type Language = 'en' | 'am' | 'om';

export interface CategoryInfo {
  id: string;
  en: string;
  am: string;
  om: string;
  icon: string;
  hashtag: string;
}

export function escapeHtml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'confession',
    icon: '🕊️',
    en: 'Confession & Repentance',
    am: 'የንስሐ እና የልብ ቃል',
    om: 'Qalbii Jijjiirrachuu fi Kadhannaa',
    hashtag: '#Confession',
  },
  {
    id: 'prayer',
    icon: '🙏',
    en: 'Prayer Request',
    am: 'የጸሎት ጥያቄ',
    om: 'Gaaffii Kadhannaa',
    hashtag: '#PrayerRequest',
  },
  {
    id: 'testimony',
    icon: '🌟',
    en: 'Testimony of Faith',
    am: 'የእምነት ምስክርነት',
    om: 'Dhugaa Ba\'umsa Amantii',
    hashtag: '#Testimony',
  },
  {
    id: 'relationship',
    icon: '🤝',
    en: 'Friendship & Relationships',
    am: 'የጓደኝነትና ግንኙነት ተሞክሮ',
    om: 'Hiriyyummaa fi Walitti Dhufeenya',
    hashtag: '#Fellowship',
  },
  {
    id: 'life_experience',
    icon: '💡',
    en: 'Life Experience & Advice',
    am: 'የሕይወት ተሞክሮ እና ምክር',
    om: 'Muuxannoo Jireenyaa fi Gorsa',
    hashtag: '#LifeExperience',
  },
  {
    id: 'other',
    icon: '💬',
    en: 'General & Other Thoughts',
    am: 'አጠቃላይ / ሌላ ሀሳብ',
    om: 'Yaada Waliigalaa / Kan Biraa',
    hashtag: '#General',
  },
];

export const TRANSLATIONS = {
  en: {
    bot_name: 'Focus Harar Confession',
    welcome_title: '🕊️ Welcome to Focus Harar Confession Bot',
    welcome_body: `Grace and peace to you in Christ! 🙏

This anonymous bot provides a safe, confidential space for our church community to share confessions, prayer requests, testimonies, and experiences.

🔒 <b>100% Anonymous & Private:</b>
• Your Telegram identity (Name, Username, ID) is NEVER revealed.
• Moderated by authorized church leaders before posting.
• Only edifying, respectful content is published to our channel.

Please select an option below to begin:`,
    btn_submit: '✍️ Submit Confession',
    btn_categories: '📂 Browse Categories',
    btn_language: '🌐 Change Language',
    btn_rules: '🛡️ Privacy & Guidelines',
    btn_channel: '📢 Join Our Channel',
    btn_cancel: '❌ Cancel',
    btn_confirm: '✅ Confirm & Send Anonymously',
    btn_back: '🔙 Main Menu',

    choose_category: `📂 <b>Step 1 of 2: Select a Category</b>\n\nTap a category below, <i>or simply type your message right now and send it!</i>\n(Default: 🙏 Prayer Request)`,
    write_prompt: (catName: string) =>
      `✍️ <b>Step 2 of 2: Write Your Message</b>\n\nCategory: <b>${escapeHtml(catName)}</b>\n\nPlease type your message below and send it. Take your time. Your privacy is strictly preserved.`,
    confirm_prompt: (catName: string, text: string) =>
      `🕊️ <b>Please Review Your Submission</b>\n\n📌 <b>Category:</b> ${escapeHtml(catName)}\n\n📝 <b>Your Message:</b>\n\n"<i>${escapeHtml(text)}</i>"\n\n🔒 <i>Reminder: Your sender identity is never attached or published.</i>\n\nAre you ready to submit this for church moderation?`,
    submission_success: `✅ <b>Your submission has been received anonymously!</b>\n\nIt is now in the queue for our church administration team to review. Once approved according to Christian fellowship guidelines, it will be published to our channel:\n👉 @focushararconfession\n\nMay God bless your heart! 🙏`,
    cancelled: '❌ Submission cancelled. Returning to main menu.',
    rate_limited: (seconds: number) =>
      `⏳ <b>Please wait a moment!</b>\nTo prevent spam, you can submit another message in <b>${seconds} seconds</b>.\nThank you for your patience!`,
    daily_limit: '⚠️ You have reached the maximum daily submissions (10). Please return tomorrow. God bless you!',
    privacy_policy: `🛡️ <b>Privacy & Community Guidelines</b>

1. <b>Strict Anonymity:</b> We do NOT publish or save your Telegram username, profile, or user ID with the confession.
2. <b>Church Moderation:</b> All submissions are reviewed by five trusted church administrators before publication to maintain grace, truth, and respect.
3. <b>Christian Edification:</b> Please refrain from slander, specific accusations against named individuals, hate speech, vulgarity, or personal contact info.
4. <b>Channel:</b> Approved confessions appear on @focushararconfession.

<i>"Therefore confess your sins to each other and pray for each other so that you may be healed." — James 5:16</i>`,
    channel_info: `📢 <b>Focus Harar Confession Channel</b>\n\nRead approved confessions, join in collective prayer, and stay encouraged!\n\n🔗 Channel: @focushararconfession`,
    choose_lang: '🌐 Please choose your preferred language / እባክዎ ቋንቋ ይምረጡ / Afaan filadhaa:',
    lang_changed: '✅ Language updated to English!',
  },

  am: {
    bot_name: 'ፎከስ ሐረር የንስሐና ምስክርነት ቦት',
    welcome_title: '🕊️ ወደ ፎከስ ሐረር የንስሐና ምስክርነት ቦት በደህና መጡ',
    welcome_body: `የጌታችን የኢየሱስ ክርስቶስ ጸጋና ሰላም ከእናንተ ጋር ይሁን! 🙏

ይህ ቦት ለቤተክርስቲያናችን ወጣቶችና አባላት የልብ ሸክማቸውን፣ የንስሐ ቃላቸውን፣ የጸሎት ጥያቄያቸውን፣ ምስክርነታቸውን እና የሕይወት ተሞክሯቸውን በሙሉ ሚስጥራዊነት የሚያካፍሉበት የተዘጋጀ መንፈሳዊ መድረክ ነው።

🔒 <b>100% ሙሉ ሚስጥራዊነት:</b>
• የእርስዎ ማንነት (ስም፣ የተጠቃሚ ስም ወይም የቴሌግራም ID) በጭራሽ አይታወቅም ወይም አይለጠፍም።
• መልእክቶች በአስተዳዳሪዎች ቡድን ተገምግመው ወደ ቻናሉ ይለጠፋሉ።
• ገንቢ እና መንፈሳዊ ይዘት ያላቸው ብቻ ይፀድቃሉ።

ለመጀመር ከታች ካሉት አማራጮች አንዱን ይምረጡ:`,
    btn_submit: '✍️ መልእክት / ንስሐ ላክ',
    btn_categories: '📂 ምድቦችን ተመልከት',
    btn_language: '🌐 ቋንቋ ቀይር',
    btn_rules: '🛡️ ሚስጥራዊነትና መመሪያ',
    btn_channel: '📢 ቻናላችንን ተቀላቀል',
    btn_cancel: '❌ ሰርዝ',
    btn_confirm: '✅ አረጋግጥና በድብቅ ላክ',
    btn_back: '🔙 ወደ ዋናው ማውጫ',

    choose_category: `📂 <b>ደረጃ 1 ከ 2: የምድብ ምርጫ</b>\n\nከታች ካሉት ምድቦች ይምረጡ፣ <i>ወይም መልእክትዎን አሁኑኑ ጽፈው ይላኩ!</i>\n(ቀጥታ ከጻፉ: 🙏 የጸሎት ጥያቄ)`,
    write_prompt: (catName: string) =>
      `✍️ <b>ደረጃ 2 ከ 2: መልእክትዎን ይጻፉ</b>\n\nምድብ: <b>${escapeHtml(catName)}</b>\n\nእባክዎ መልእክትዎን ከታች ጽፈው ይላኩ። ማንነትዎ ፍፁም ሚስጥር እንደሆነ ይቆያል።`,
    confirm_prompt: (catName: string, text: string) =>
      `🕊️ <b>እባክዎ መልእክትዎን ያረጋግጡ</b>\n\n📌 <b>ምድብ:</b> ${escapeHtml(catName)}\n\n📝 <b>የተጻፈው መልእክት:</b>\n\n"<i>${escapeHtml(text)}</i>"\n\n🔒 <i>ማስታወሻ: ማንነትዎ በጭራሽ ከጽሑፉ ጋር አይያያዝም።</i>\n\nይህ መልእክት ወደ አስተዳዳሪዎች እንዲላክ ይፈልጋሉ?`,
    submission_success: `✅ <b>መልእክትዎ በሙሉ ሚስጥራዊነት ደርሶናል!</b>\n\nበአስተዳዳሪዎች ተገምግሞ መንፈሳዊ ስርዓትን የጠበቀ ከሆነ ወደ ዋናው ቻናላችን ይለጠፋል:\n👉 @focushararconfession\n\nእግዚአብሔር ልብዎን ይባርክ! 🙏`,
    cancelled: '❌ መልእክት መላኩ ተሰርዟል። ወደ ዋናው ማውጫ ተመልሰዋል።',
    rate_limited: (seconds: number) =>
      `⏳ <b>እባክዎ ጥቂት ይጠብቁ!</b>\nተከታታይ ስፓም እንዳይኖር፣ ቀጣዩን መልእክት ለመላክ <b>${seconds} ሰከንዶች</b> መጠበቅ አለብዎት።\nለትዕግስትዎ እናመሰግናለን!`,
    daily_limit: '⚠️ የዕለቱን ከፍተኛ የመልእክት ብዛት (10) ጨርሰዋል። እባክዎ ነገ ይመለሱ። እግዚአብሔር ይባርክዎ!',
    privacy_policy: `🛡️ <b>የሚስጥራዊነት እና የአጠቃቀም መመሪያ</b>

1. <b>ፍጹም ሚስጥራዊነት:</b> የእርስዎ ስም፣ መለያ ወይም የቴሌግራም ID በምንም አይነት ሁኔታ አይገለጽም ወይም ከጽሑፉ ጋር አይቀመጥም።
2. <b>አስተዳደራዊ ግምገማ:</b> ሁሉም መልእክቶች በአስተዳዳሪዎች ታይተው ክርስቲያናዊ ስርዓትን የጠበቁ መሆናቸው ከተረጋገጠ በኋላ ይለጠፋሉ።
3. <b>መንፈሳዊ ይዘት:</b> የስም ማጥፋት፣ ግለሰቦችን በስም መጥቀስ፣ ዛቻ፣ የጥላቻ ንግግር ወይም ተገቢ ያልሆኑ ቃላትን ከመጠቀም ይቆጠቡ።
4. <b>ቻናል:</b> የጸደቁ መልእክቶች @focushararconfession ላይ ይለጠፋሉ።

<i>"እርስ በርሳችሁ በኃጢአታችሁ ተናዘዙ፥ ትፈወሱም ዘንድ አንዱ ስለ አንዱ ይጸልይ፤" — ያዕቆብ 5:16</i>`,
    channel_info: `📢 <b>የፎከስ ሐረር ቻናል</b>\n\nየተፈቀዱ መልእክቶችን ለመከታተልና በጸሎት ለመተባበር:\n\n🔗 ቻናል: @focushararconfession`,
    choose_lang: '🌐 እባክዎ የሚፈልጉትን ቋንቋ ይምረጡ / Please choose your language / Afaan filadhaa:',
    lang_changed: '✅ ቋንቋው ወደ አማርኛ ተቀይሯል!',
  },

  om: {
    bot_name: 'Focus Harar Botii Yaadaa fi Qalbii Jijjiirraa',
    welcome_title: '🕊️ Baga Gara Botii Focus Harar nagaan dhuftan',
    welcome_body: `Ayyaanni fi nagaan Gooftaa keenya Yesuus Kiristoos isinii wajjin haa ta'u! 🙏

Botiin kun miseensota waldaa keenyaatiif yaada garaa isaanii, qalbii jijjiirraa, gaaffii kadhannaa, dhugaa ba'umsa fi muuxannoo jireenyaa iccitii guutuun akka qooddataniif kan qophaa'edha.

🔒 <b>Iccitii Guutuu 100%:</b>
• Eenyummaan keessan (Maqaa, Username ykn Telegram ID) gonkumaa hin beekamu ykn hin maxxanfamu.
• Hoggantoota waldichaan erga ilaallamee mirkanaa'ee booda gara chaanaaliitti maxxanfama.
• Yaada ijaaraa fi sirrii ta'e qofatu maxxanfama.

Jalqabuuf filannoowwan armaan gadii keessaa tokko filadhaa:`,
    btn_submit: '✍️ Yaada / Qalbii Jijjiirraa Ergi',
    btn_categories: '📂 Ramaddiiwwan Ilaali',
    btn_language: '🌐 Afaan Jijjiiri',
    btn_rules: '🛡️ Iccitiifi Qajeelfama',
    btn_channel: '📢 Chaanaalii Keenya',
    btn_cancel: '❌ Haqi',
    btn_confirm: '✅ Mirkaneessiitii Ergi',
    btn_back: '🔙 Gara Ka\'umsaatti',

    choose_category: `📂 <b>Sadarkaa 1ffaa: Ramaddii Filadhaa</b>\n\nRamaddii armaan gadii filadhaa, <i>ykn ammumuma ergaa keessan barreessaa ergaa!</i>\n(Kallattiin yoo barreessitan: 🙏 Gaaffii Kadhannaa)`,
    write_prompt: (catName: string) =>
      `✍️ <b>Sadarkaa 2ffaa: Ergaa keessan barreessaa</b>\n\nRamaddii: <b>${escapeHtml(catName)}</b>\n\nMaaloo ergaa keessan armaan gaditti barreessaa ergaa. Eenyummaan keessan guutummaatti iccitii ta'ee hafa.`,
    confirm_prompt: (catName: string, text: string) =>
      `🕊️ <b>Maaloo Ergaa Keessan Mirkaneessaa</b>\n\n📌 <b>Ramaddii:</b> ${escapeHtml(catName)}\n\n📝 <b>Ergaa Keessan:</b>\n\n"<i>${escapeHtml(text)}</i>"\n\n🔒 <i>Hubachiisa: Eenyummaan keessan gonkumaa ergaa kanaan walitti hin qabamu.</i>\n\nErgaan kun akka hoggantootatti darbu ni barbaadduu?`,
    submission_success: `✅ <b>Ergaan keessan iccitii guutuun nu ga'eera!</b>\n\nHoggantoota waldichaan erga ilaalamee booda chaanaalii keenyarratti kan maxxanfamu ta'a:\n👉 @focushararconfession\n\nWaaqayyo isin haa eebbisu! 🙏`,
    cancelled: '❌ Ergaan haqameera. Gara baafata duraatti deebitanii jirtu.',
    rate_limited: (seconds: number) =>
      `⏳ <b>Maaloo yeroo gabaabaaf eegaa!</b>\nSpam ittisuuf, ergaa biraa erguuf <b>sekondii ${seconds}</b> eeguu qabdu.\nObsa keessaniif galatoomaa!`,
    daily_limit: '⚠️ Baay\'ina ergaa guyyaa tokkoo (10) xumurtanii jirtu. Maaloo boru deebi\'aa. Waaqayyo isin haa eebbisu!',
    privacy_policy: `🛡️ <b>Qajeelfama Iccitii fi Itti Fayyadamaa</b>

1. <b>Iccitii Guutuu:</b> Maqaan, maqaan fayyadamaa yookiin ID Telegram keessanii gonkumaa hin ibsamu.
2. <b>Gamaaggama Hoggantootaa:</b> Ergaawwan hundi hoggantoota waldichaan ilaallamanii erga mirkanaa'anii booda maxxanfamu.
3. <b>Seera Hawaasummaa:</b> Maqaa balleessuu, maqaa namaa callisanii dhiyeessuu, jibbiinsaa fi dubbii gadhee irraa fagaadhaa.
4. <b>Chaanaalii:</b> Ergaawwan hayyamaman @focushararconfession irratti maxxanfamu.

<i>"Kanaafis fayyina akka argattaniif cubbuu keessan walitti himadhaa, walii keessaniifis kadhadhaa." — Yaaqoob 5:16</i>`,
    channel_info: `📢 <b>Chaanaalii Focus Harar</b>\n\nErgaawwan hayyamaman hordofuuf fi kadhannaadhaan hirmaachuuf:\n\n🔗 Chaanaalii: @focushararconfession`,
    choose_lang: '🌐 Maaloo afaan barbaaddan filadhaa / እባክዎ ቋንቋ ይምረጡ / Please choose your language:',
    lang_changed: '✅ Afaan gara Afaan Oromootti jijjiirameera!',
  },
};

export function getCategoryName(categoryId: string, lang: Language): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return categoryId;
  return `${cat.icon} ${cat[lang]}`;
}

export function formatChannelPost(confession: {
  id: number;
  formatted_id: string;
  category: string;
  language: string;
  content: string;
  created_at: string;
}): string {
  const cat = CATEGORIES.find((c) => c.id === confession.category);
  const catTitle = cat ? `${cat.icon} ${escapeHtml(cat.en)} | ${escapeHtml(cat.am)}` : `#${escapeHtml(confession.category)}`;
  const hashtag = cat?.hashtag || '#Confession';
  
  const dateFormatted = new Date(confession.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `╭───────────────❖───────────────╮
    ⛪ <b>FOCUS HARAR FELLOWSHIP</b> 
╰───────────────❖───────────────╯
📌 <b>Submission:</b> <code>${escapeHtml(confession.formatted_id)}</code>
📁 <b>Category:</b> ${catTitle}
📅 <b>Date:</b> ${dateFormatted}
🔒 <b>Status:</b> Verified Anonymous

━━━━━━━━━━━━━━━━━━━━━━━━━━
${escapeHtml(confession.content)}
━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ <i>“Therefore encourage one another and build each other up, just as in fact you are doing.” — 1 Thess. 5:11</i>

🕊️ Submit your anonymous reflection: @focusconfessionbot
📢 Official Channel: @focushararconfession
🏷️ ${hashtag} #FocusHarar #FellowConfession #ChurchCommunity`;
}
