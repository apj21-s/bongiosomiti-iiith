'use client'

import { useEffect, useState } from 'react'

type Dish = {
  nameBn: string
  nameEn: string
  description: string
  type: 'veg' | 'nonveg'
  image: string
  searchQuery: string
}

const MAHALAYA_MENU: Dish[] = [
  { nameBn: 'বাসন্তী পোলাও', nameEn: 'Fragrant Basanti Pulao', description: 'Slow-cooked Gobindobhog rice with ghee, cashews and raisins.', type: 'veg', image: '/assets/menu-basanti-pulao.jpg', searchQuery: 'Basanti Pulao Bengali dish' },
  { nameBn: 'ঝুরি আলু ভাজা', nameEn: 'Crispy Jhuri Aloo Bhaja', description: 'Golden shredded potato crispies, seasoned with salt and a touch of chilli.', type: 'veg', image: '/assets/menu-jhuri-aloo.jpg', searchQuery: 'Jhuri Aloo Bhaja Bengali dish' },
  { nameBn: 'মুচমুচে বেগুনী', nameEn: 'Crispy Beguni', description: 'Traditional batter-fried spiced eggplant slices.', type: 'veg', image: '/assets/menu-beguni.jpg', searchQuery: 'Beguni Bengali dish' },
  { nameBn: 'দুধ শুক্তো', nameEn: 'Traditional Dudh Shukto', description: 'Classic Bengali bittersweet vegetable medley in milk gravy.', type: 'veg', image: '/assets/menu-shukto.jpg', searchQuery: 'Dudh Shukto Bengali dish' },
  { nameBn: 'ছানার ডালনা', nameEn: 'Traditional Chhanar Dalna', description: 'Fresh cottage cheese koftas in rich cumin gravy.', type: 'veg', image: '/assets/menu-chhanar-dalna.jpg', searchQuery: 'Chhanar Dalna Bengali dish' },
  { nameBn: 'ধোঁকার ডালনা', nameEn: 'Dhokar Dalna', description: 'Spiced lentil cakes simmered in aromatic gravy.', type: 'veg', image: '/assets/menu-dhokar-dalna.jpg', searchQuery: 'Dhokar Dalna Bengali dish' },
  { nameBn: 'নারকেল দিয়ে ছোলার ডাল', nameEn: 'Narkel diye Chholar Dal', description: 'Bengal gram with coconut crisps and warm spices.', type: 'veg', image: '/assets/menu-chholar-dal.jpg', searchQuery: 'Chholar Dal Bengali dish' },
  { nameBn: 'গরম ফুলকো লুচি', nameEn: 'Garam Luchi / Radhaballabhi', description: 'Puffed golden deep-fried puris served piping hot.', type: 'veg', image: '/assets/menu-luchi.jpg', searchQuery: 'Bengali Luchi puri' },
  { nameBn: 'টমেটো খেজুর চাটনি', nameEn: 'Tomato-Khejur Sweet Chutney', description: 'Rich spiced dates and tomato relish.', type: 'veg', image: '/assets/menu-chutney.jpg', searchQuery: 'Tomato Khejur Chutney Bengali' },
  { nameBn: 'মুচমুচে পাপড় ভাজা', nameEn: 'Crispy Roasted Papad', description: 'Traditional crispy lentil wafers, flame-roasted.', type: 'veg', image: '/assets/menu-papad.jpg', searchQuery: 'Papad Indian crispy wafer' },
  { nameBn: 'নলেন গুড়ের রসগোল্লা', nameEn: 'Spongy Nolen Gur Rosogolla', description: 'Soft cottage cheese balls in date palm jaggery syrup.', type: 'veg', image: '/assets/menu-rosogolla.jpg', searchQuery: 'Nolen Gur Rosogolla Bengali sweet' },
  { nameBn: 'কলকাতার খাঁটি মিষ্টি দই', nameEn: 'Authentic Kolkata Mishti Doi', description: 'Caramelised sweetened yoghurt set in earthen pots.', type: 'veg', image: '/assets/menu-rosogolla.jpg', searchQuery: 'Mishti Doi Kolkata Bengali sweet' },
  { nameBn: 'গোবিন্দভোগ চালের পায়েস', nameEn: 'Gobindobhog Chaler Payesh', description: 'Creamy slow-cooked rice pudding with aromatic Gobindobhog rice.', type: 'veg', image: '/assets/menu-rosogolla.jpg', searchQuery: 'Payesh Bengali rice pudding' },
  { nameBn: 'নরোম পাকের সন্দেশ', nameEn: 'Traditional Bengali Sandesh', description: 'Delicate fresh cottage cheese confection with cardamom.', type: 'veg', image: '/assets/menu-rosogolla.jpg', searchQuery: 'Bengali Sandesh sweet' },
  { nameBn: 'কাতলা / রুই মাছের কালিয়া', nameEn: 'Katla Machher Kalia', description: 'Rich river carp in spiced onion-ginger gravy.', type: 'nonveg', image: '/assets/menu-katla-kalia.jpg', searchQuery: 'Katla Machher Kalia Bengali fish curry' },
  { nameBn: 'কষা মাংস', nameEn: 'Traditional Bengali Kosha Mangsho', description: 'Slow-cooked rich spiced mutton curry with potatoes.', type: 'nonveg', image: '/assets/menu-kosha-mangsho.jpg', searchQuery: 'Kosha Mangsho Bengali mutton curry' },
]

const SARASWATI_COURSES = [
  {
    emoji: '🌸',
    title: 'সকালের অঞ্জলি ও ফল প্রসাদ (Morning Pushpanjali & Prasad)',
    items: [
      { title: 'বাসন্তী ক্ষীর ও সন্দেশ (Basanti Kheer & Sandesh)', desc: 'Pure saffron milk kheer with handmade cottage cheese sandesh' },
      { title: 'পঞ্চফল ও মিষ্টি বাতাসা (Panchaphal & Batasa)', desc: 'Fresh seasonal fruits, topa kul, and sugar drops' },
      { title: 'ভিজানো ছোলা, আদা ও শসা (Sprouted Gram & Ginger)', desc: 'Auspicious holy offering' },
    ],
  },
  {
    emoji: '🍲',
    title: 'মহাপ্রসাদ মধ্যাহ্নভোজ (Community Khichuri Prosad Feast)',
    items: [
      { title: 'ঘিয়ে ভাজা ভোগের খিচুড়ি (Bhoger Khichuri)', desc: 'Aromatic Gobindobhog rice & roasted Sona Moong dal simmered in pure Desi Ghee with green peas & whole spices' },
      { title: 'সাতমিশালি লাবড়া (Sacred Niramish Labra)', desc: '7-vegetable traditional temple medley with Panch Phoron' },
      { title: 'মুচমুচে বেগুনী ও ফুলকপি রোস্ট (Crispy Beguni & Cauliflower Roast)', desc: 'Golden fried eggplant & rich cashew-curd spiced cauliflower' },
      { title: 'টমেটো-খেজুর-আমসত্ত্বের মিষ্টি চাটনি (Tomato-Khejur-Aamsotto Chutney)', desc: 'Traditional sweet mango-pulp and dates relish' },
      { title: 'মুচমুচে ভাজা পাপড় (Crispy Papad Bhaja)', desc: '' },
    ],
  },
  {
    emoji: '🍨',
    title: 'অন্তিম মিষ্টি মুখ (Traditional Desserts & Mishti)',
    items: [
      { title: 'মাটির ভাঁড়ে গোবিন্দভোগ চালের পায়েস (Gobindobhog Rice Payesh in Earthen Pots)', desc: '' },
      { title: 'কমলাভোগ ও নরম পাকের রসগোল্লা (Kamlabhog & Soft Rosogolla)', desc: '' },
      { title: 'নলেন গুড়ের কাঁচাগোল্লা (Nolen Gur Kanchagolla)', desc: '' },
      { title: 'খাঁটি মিষ্টি দই (Authentic Bengali Mishti Doi)', desc: '' },
    ],
  },
]

export default function MenuCardModal({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const isMahalaya = slug === 'mahalaya'
  const vegDishes = MAHALAYA_MENU.filter((d) => d.type === 'veg')
  const nonvegDishes = MAHALAYA_MENU.filter((d) => d.type === 'nonveg')

  function renderMahalayaDishes(dishes: Dish[]) {
    return dishes.map((dish, i) => {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(dish.searchQuery)}`
      return (
        <a
          key={dish.nameEn}
          className="mahalaya-menu-dish"
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ animationDelay: `${i * 0.06}s` }}
          title={`Search: ${dish.nameEn}`}
        >
          <div className="mahalaya-menu-dish__thumb">
            <img src={dish.image} alt={dish.nameBn} width="48" height="48" loading="lazy" decoding="async" />
          </div>
          <div className="mahalaya-menu-dish__info">
            <div className="mahalaya-menu-dish__name-row">
              <span className={`mahalaya-menu-dish__diet-mark mahalaya-menu-dish__diet-mark--${dish.type}`}></span>
              <span className="mahalaya-menu-dish__name-bn">{dish.nameBn}</span>
            </div>
            <span className="mahalaya-menu-dish__name-en">{dish.nameEn}</span>
            {dish.description && <span className="mahalaya-menu-dish__desc">{dish.description}</span>}
          </div>
          <span className="mahalaya-menu-dish__learn">↗</span>
        </a>
      )
    })
  }

  return (
    <>
      <div className={isMahalaya ? 'mahalaya-menu-card-showcase' : 'saraswati-menu-card-showcase'}>
        <button
          type="button"
          className={isMahalaya ? 'mahalaya-menu-card-btn' : 'saraswati-menu-card-btn'}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={isMahalaya ? 'Open Mahalaya Bhoj Menu Card' : 'Open Saraswati Puja Menu Card'}
        >
          <div className={isMahalaya ? 'mahalaya-menu-card-frame' : 'saraswati-menu-card-frame'}>
            <img
              src="/assets/mahalaya-menu-envelope.png"
              alt={isMahalaya ? 'Official Mahalaya Bhoj Menu Card Envelope with Golden Seal' : 'Official Saraswati Puja Khichuri Bhog Menu Card Envelope with Golden Seal'}
              loading="lazy"
              decoding="async"
              className={isMahalaya ? 'mahalaya-menu-card-img' : 'saraswati-menu-card-img'}
            />
          </div>
        </button>
      </div>

      {open && (
        <div className={isMahalaya ? 'mahalaya-menu-modal' : 'saraswati-menu-modal'} role="dialog" aria-modal="true" aria-labelledby={isMahalaya ? 'menu-modal-title' : 'saraswati-menu-modal-title'}>
          <div className="mahalaya-menu-modal__backdrop" onClick={() => setOpen(false)}></div>
          <div className={isMahalaya ? 'mahalaya-menu-modal__dialog' : 'saraswati-menu-modal__dialog'}>
            <button
              type="button"
              className={isMahalaya ? 'mahalaya-menu-modal__close' : 'saraswati-menu-modal__close'}
              onClick={() => setOpen(false)}
              aria-label="Close Menu Card"
            >
              &times;
            </button>

            <div className={isMahalaya ? 'mahalaya-menu-modal__envelope-banner' : 'saraswati-menu-modal__envelope-banner'}>
              <img
                src="/assets/mahalaya-menu-envelope.png"
                alt={isMahalaya ? 'Mahalaya Bhoj Royal Menu Envelope with IIIT Hyderabad Golden Seal' : 'Saraswati Puja Royal Menu Envelope with IIIT Hyderabad Golden Seal'}
                loading="lazy"
                decoding="async"
                className={isMahalaya ? 'mahalaya-menu-modal__envelope-img' : 'saraswati-menu-modal__envelope-img'}
              />
            </div>

            <div className={isMahalaya ? 'mahalaya-menu-modal__body' : 'saraswati-menu-modal__body'}>
              <div className={isMahalaya ? 'mahalaya-menu-modal__header' : 'saraswati-menu-modal__header'}>
                <span className={isMahalaya ? 'mahalaya-menu-modal__tag' : 'saraswati-menu-modal__tag'}>
                  {isMahalaya ? 'IIIT HYDERABAD BONGIO SAMITI' : '🌼 BASANT PANCHAMI 2027 🌼'}
                </span>
                <h3 id={isMahalaya ? 'menu-modal-title' : 'saraswati-menu-modal-title'} className={isMahalaya ? 'mahalaya-menu-modal__title' : 'saraswati-menu-modal__title'}>
                  {isMahalaya ? 'মহালয়া ভোজ মেনু কার্ড' : 'সরস্বতী পূজা ও খিচুড়ি ভোগ মেনু কার্ড'}
                </h3>
                <p className={isMahalaya ? 'mahalaya-menu-modal__subtitle' : 'saraswati-menu-modal__subtitle'}>
                  {isMahalaya
                    ? 'Grand Traditional Autumn Bhoj • 12 October 2026 • Community Courtyard'
                    : 'Grand Sacred Feast • 21 January 2027 • Campus Courtyard & Dining Hall'}
                </p>
              </div>

              {isMahalaya ? (
                <div className="mahalaya-menu-modal__sections" id="mahalaya-menu-sections">
                  <div className="mahalaya-menu-diet-section">
                    <div className="mahalaya-menu-diet-section__header">
                      <span className="mahalaya-menu-diet-symbol mahalaya-menu-diet-symbol--veg"></span>
                      <span className="mahalaya-menu-diet-section__label">
                        <span className="mahalaya-menu-diet-section__label-bn">নিরামিষ</span> · VEGETARIAN
                      </span>
                    </div>
                    <div className="mahalaya-menu-dish-grid">{renderMahalayaDishes(vegDishes)}</div>
                  </div>
                  <div className="mahalaya-menu-diet-section">
                    <div className="mahalaya-menu-diet-section__header">
                      <span className="mahalaya-menu-diet-symbol mahalaya-menu-diet-symbol--nonveg"></span>
                      <span className="mahalaya-menu-diet-section__label">
                        <span className="mahalaya-menu-diet-section__label-bn">আমিষ</span> · NON-VEGETARIAN
                      </span>
                    </div>
                    <div className="mahalaya-menu-dish-grid">{renderMahalayaDishes(nonvegDishes)}</div>
                  </div>
                </div>
              ) : (
                <div className="saraswati-menu-modal__sections">
                  {SARASWATI_COURSES.map((course) => (
                    <div className="saraswati-menu-course" key={course.title}>
                      <h4 className="saraswati-menu-course__heading">
                        <span>{course.emoji}</span> {course.title}
                      </h4>
                      <ul className="saraswati-menu-course__list">
                        {course.items.map((item) => (
                          <li key={item.title}>
                            <strong>{item.title}</strong>
                            {item.desc && <> &bull; {item.desc}</>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className={isMahalaya ? 'mahalaya-menu-modal__footer' : 'saraswati-menu-modal__footer'}>
                {isMahalaya ? (
                  <>
                    <p className="mahalaya-menu-modal__footer-timing">Feast timings: <strong>1:00 PM – 4:30 PM</strong> &bull; Unlimited traditional sit-down banana leaf service</p>
                    <p className="mahalaya-menu-modal__footer-closing">পরম্পরার স্বাদে, একসাথে বসে।</p>
                  </>
                ) : (
                  <p>✨ Sit-down lunch timings: <strong>12:30 PM – 3:30 PM</strong> &bull; Free community feast for all attendees with pass</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
