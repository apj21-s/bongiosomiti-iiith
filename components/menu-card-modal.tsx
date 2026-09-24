'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Dish = {
  nameBn: string
  nameEn: string
  description: string
  type: 'veg' | 'nonveg'
  meal?: 'breakfast' | 'lunch'
  image: string
  searchQuery: string
}

const MAHALAYA_MENU: Dish[] = [
  // BREAKFAST MENU ITEMS
  { nameBn: 'গরম ফুলকো লুচি', nameEn: 'Garam Luchi / Radhaballabhi', description: 'Puffed golden deep-fried puris served piping hot.', type: 'veg', meal: 'breakfast', image: '/assets/menu-luchi.jpg', searchQuery: 'Bengali Luchi puri' },
  { nameBn: 'হিং দিয়ে আলুর দম', nameEn: 'Classic Hing-Aloor Dom', description: 'Slow-simmered baby potatoes in asafoetida & cumin gravy.', type: 'veg', meal: 'breakfast', image: '/assets/menu-jhuri-aloo.jpg', searchQuery: 'Hing Aloor Dom Bengali dish' },
  { nameBn: 'নারকেল দিয়ে ছোলার ডাল', nameEn: 'Narkel diye Chholar Dal', description: 'Bengal gram with fried coconut crisps and warm aromatic spices.', type: 'veg', meal: 'breakfast', image: '/assets/menu-chholar-dal.jpg', searchQuery: 'Chholar Dal Bengali dish' },
  { nameBn: 'রসগোল্লা', nameEn: 'Classic Rosogolla', description: 'Soft, spongy cottage cheese balls soaked in light sugar syrup.', type: 'veg', meal: 'breakfast', image: '/assets/menu-rosogolla.jpg', searchQuery: 'Bengali Rosogolla sweet' },
  // LUNCH FEAST (NON-VEG)
  { nameBn: 'লেবু, লবণ ও স্যালাড', nameEn: 'Lemon, Salt & Green Salad', description: 'Fresh cucumber, tomato, onion slices, lemon wedge and sea salt.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-salad.jpg', searchQuery: 'Bengali green salad with lemon' },
  { nameBn: 'ভাত', nameEn: 'Bhaat', description: 'Steaming white rice.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-bhaat.jpg', searchQuery: 'Bengali steamed rice' },
  { nameBn: 'আলুভাজা', nameEn: 'Aloo Bhaja', description: 'Crispy fried julienned potatoes.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-jhuri-aloo.jpg', searchQuery: 'Jhuri Aloo Bhaja Bengali dish' },
  { nameBn: 'কড়াইশুঁটি দিয়ে মুগ ডাল', nameEn: 'Moong Dal with Green Peas', description: 'Comforting yellow lentils with fresh green peas.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-moong-dal.jpg', searchQuery: 'Koraishutir Moong Dal Bengali' },
  { nameBn: 'ফুলকপির রসা', nameEn: 'Fulkopir Rosa', description: 'Rich traditional cauliflower and potato curry.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-fulkopi.jpg', searchQuery: 'Fulkopir Rosa Bengali dish' },
  { nameBn: 'দই কাতলা', nameEn: 'Doi Katla', description: 'River carp gently simmered in a creamy yogurt gravy.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-doi-katla.jpg', searchQuery: 'Doi Katla Bengali fish curry' },
  { nameBn: 'পাবদা ঝাল', nameEn: 'Pabda Jhal', description: 'Whole Pabda fish in a spicy mustard and tomato gravy.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-pabda.jpg', searchQuery: 'Pabda Macher Jhal Bengali' },
  { nameBn: 'চাটনি', nameEn: 'Chutney', description: 'Traditional sweet tomato and date relish.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-chutney.jpg', searchQuery: 'Tomato Khejur Chutney Bengali' },
  { nameBn: 'পাঁপড়', nameEn: 'Papad', description: 'Crispy lentil wafers.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-papad.jpg', searchQuery: 'Bengali Papad' },
  { nameBn: 'পায়েস', nameEn: 'Payesh', description: 'Creamy slow-cooked rice pudding.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-payesh.jpg', searchQuery: 'Payesh Bengali rice pudding' },
  { nameBn: 'জোয়ান', nameEn: 'Jowan', description: 'Traditional digestive carom seeds.', type: 'nonveg', meal: 'lunch', image: '/assets/menu-papad.jpg', searchQuery: 'Mukhwas Jowan' },

  // LUNCH FEAST (VEG)
  { nameBn: 'লেবু, লবণ ও স্যালাড', nameEn: 'Lemon, Salt & Green Salad', description: 'Fresh cucumber, tomato, onion slices, lemon wedge and sea salt.', type: 'veg', meal: 'lunch', image: '/assets/menu-salad.jpg', searchQuery: 'Bengali green salad with lemon' },
  { nameBn: 'ভাত', nameEn: 'Bhaat', description: 'Steaming white rice.', type: 'veg', meal: 'lunch', image: '/assets/menu-bhaat.jpg', searchQuery: 'Bengali steamed rice' },
  { nameBn: 'আলুভাজা', nameEn: 'Aloo Bhaja', description: 'Crispy fried julienned potatoes.', type: 'veg', meal: 'lunch', image: '/assets/menu-jhuri-aloo.jpg', searchQuery: 'Jhuri Aloo Bhaja Bengali dish' },
  { nameBn: 'কড়াইশুঁটি দিয়ে মুগ ডাল', nameEn: 'Moong Dal with Green Peas', description: 'Comforting yellow lentils with fresh green peas.', type: 'veg', meal: 'lunch', image: '/assets/menu-moong-dal.jpg', searchQuery: 'Koraishutir Moong Dal Bengali' },
  { nameBn: 'ফুলকপির রসা', nameEn: 'Fulkopir Rosa', description: 'Rich traditional cauliflower and potato curry.', type: 'veg', meal: 'lunch', image: '/assets/menu-fulkopi.jpg', searchQuery: 'Fulkopir Rosa Bengali dish' },
  { nameBn: 'মিক্স ভেজ (নবরত্ন)', nameEn: 'Mix Veg (Navratna)', description: 'Rich mixed vegetable korma with cashew and paneer.', type: 'veg', meal: 'lunch', image: '/assets/menu-mix-veg.jpg', searchQuery: 'Bengali Mix Veg Navratna' },
  { nameBn: 'ধোকার ডালনা', nameEn: 'Dhokar Dalna', description: 'Spiced lentil cakes simmered in aromatic cumin gravy.', type: 'veg', meal: 'lunch', image: '/assets/menu-dhokar-dalna.jpg', searchQuery: 'Dhokar Dalna Bengali dish' },
  { nameBn: 'চাটনি', nameEn: 'Chutney', description: 'Traditional sweet tomato and date relish.', type: 'veg', meal: 'lunch', image: '/assets/menu-chutney.jpg', searchQuery: 'Tomato Khejur Chutney Bengali' },
  { nameBn: 'পাঁপড়', nameEn: 'Papad', description: 'Crispy lentil wafers.', type: 'veg', meal: 'lunch', image: '/assets/menu-papad.jpg', searchQuery: 'Bengali Papad' },
  { nameBn: 'পায়েস', nameEn: 'Payesh', description: 'Creamy slow-cooked rice pudding.', type: 'veg', meal: 'lunch', image: '/assets/menu-payesh.jpg', searchQuery: 'Payesh Bengali rice pudding' },
  { nameBn: 'জোয়ান', nameEn: 'Jowan', description: 'Traditional digestive carom seeds.', type: 'veg', meal: 'lunch', image: '/assets/menu-papad.jpg', searchQuery: 'Mukhwas Jowan' },
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
  const [activeMeal, setActiveMeal] = useState<'breakfast' | 'lunch'>('lunch')
  const [expandedDiet, setExpandedDiet] = useState<'veg' | 'nonveg' | null>(null)

  useEffect(() => {
    if (!open) {
      setExpandedDiet(null)
      return
    }
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

  const vegDishes = MAHALAYA_MENU.filter((d) => d.type === 'veg' && d.meal === activeMeal)
  const nonvegDishes = MAHALAYA_MENU.filter((d) => d.type === 'nonveg' && d.meal === activeMeal)

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
        <motion.button
          layoutId={`menu-card-modal-wrapper-${slug}`}
          type="button"
          className={isMahalaya ? 'mahalaya-menu-card-btn' : 'saraswati-menu-card-btn'}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={isMahalaya ? 'Open Mahalaya Bhoj Menu Card' : 'Open Saraswati Puja Menu Card'}
          style={{ borderRadius: 8 }}
        >
          <div className={isMahalaya ? 'mahalaya-menu-card-frame' : 'saraswati-menu-card-frame'}>
            <motion.img
              layoutId={`menu-card-modal-img-${slug}`}
              src="/assets/mahalaya-menu-envelope.png"
              alt={isMahalaya ? 'Official Mahalaya Bhoj Menu Card Envelope with Golden Seal' : 'Official Saraswati Puja Khichuri Bhog Menu Card Envelope with Golden Seal'}
              loading="lazy"
              decoding="async"
              className={isMahalaya ? 'mahalaya-menu-card-img' : 'saraswati-menu-card-img'}
            />
          </div>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <div className={isMahalaya ? 'mahalaya-menu-modal' : 'saraswati-menu-modal'} role="dialog" aria-modal="true" aria-labelledby={isMahalaya ? 'menu-modal-title' : 'saraswati-menu-modal-title'}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              transition={{ duration: 0.2 }}
              className="mahalaya-menu-modal__backdrop" 
              onClick={() => setOpen(false)}
            />
            <motion.div
              layoutId={`menu-card-modal-wrapper-${slug}`}
              className={isMahalaya ? 'mahalaya-menu-modal__dialog' : 'saraswati-menu-modal__dialog'}
              style={{ borderRadius: 14 }}
            >
              <button
                type="button"
                className={isMahalaya ? 'mahalaya-menu-modal__close' : 'saraswati-menu-modal__close'}
                onClick={() => setOpen(false)}
                aria-label="Close Menu Card"
              >
                &times;
              </button>

              <div className={isMahalaya ? 'mahalaya-menu-modal__envelope-banner' : 'saraswati-menu-modal__envelope-banner'}>
                <motion.img
                  layoutId={`menu-card-modal-img-${slug}`}
                  src="/assets/mahalaya-menu-envelope.png"
                  alt={isMahalaya ? 'Mahalaya Bhoj Royal Menu Envelope with IIIT Hyderabad Golden Seal' : 'Saraswati Puja Royal Menu Envelope with IIIT Hyderabad Golden Seal'}
                  loading="lazy"
                  decoding="async"
                  className={isMahalaya ? 'mahalaya-menu-modal__envelope-img' : 'saraswati-menu-modal__envelope-img'}
                />
              </div>

              <motion.div 
                initial={{ opacity: 0, filter: 'blur(4px)' }} 
                animate={{ opacity: 1, filter: 'blur(0px)' }} 
                exit={{ opacity: 0, filter: 'blur(4px)' }} 
                transition={{ duration: 0.3, delay: 0.1 }}
                className={isMahalaya ? 'mahalaya-menu-modal__body' : 'saraswati-menu-modal__body'}
              >
              <div className={isMahalaya ? 'mahalaya-menu-modal__header' : 'saraswati-menu-modal__header'}>
                <span className={isMahalaya ? 'mahalaya-menu-modal__tag' : 'saraswati-menu-modal__tag'}>
                  {isMahalaya ? <><span className="tag-flourish">❖</span> IIIT HYDERABAD BANGIYA SAMITI <span className="tag-flourish">❖</span></> : '🌼 BASANT PANCHAMI 2027 🌼'}
                </span>
                <h3 id={isMahalaya ? 'menu-modal-title' : 'saraswati-menu-modal-title'} className={isMahalaya ? 'mahalaya-menu-modal__title' : 'saraswati-menu-modal__title'}>
                  {isMahalaya ? 'মহালয়া ভোজ মেনু কার্ড' : 'সরস্বতী পূজা ও খিচুড়ি ভোগ মেনু কার্ড'}
                </h3>
                <p className={isMahalaya ? 'mahalaya-menu-modal__subtitle' : 'saraswati-menu-modal__subtitle'}>
                  {isMahalaya
                    ? 'Mahalaya Bhoj Menu Card • 10 October 2026 • Community Courtyard'
                    : 'Grand Sacred Feast • 21 January 2027 • Campus Courtyard & Dining Hall'}
                </p>

                {isMahalaya && (
                  <div className="mahalaya-meal-tabs" role="tablist" aria-label="Meal Selection">
                    <button
                      type="button"
                      className={`mahalaya-meal-tab ${activeMeal === 'breakfast' ? 'is-active' : ''}`}
                      onClick={() => setActiveMeal('breakfast')}
                      role="tab"
                      aria-selected={activeMeal === 'breakfast'}
                    >
                      <div className="mahalaya-meal-tab__icon-wrap">
                        <span className="mahalaya-meal-tab__icon">🌅</span>
                        <span className="mahalaya-meal-tab__sunrays" aria-hidden="true"></span>
                      </div>
                      <div className="mahalaya-meal-tab__text">
                        <span className="mahalaya-meal-tab__bn">প্রাতরাশ</span>
                        <span className="mahalaya-meal-tab__en">BREAKFAST</span>
                      </div>
                    </button>
                    <span className="mahalaya-meal-tabs__divider" aria-hidden="true">❖</span>
                    <button
                      type="button"
                      className={`mahalaya-meal-tab ${activeMeal === 'lunch' ? 'is-active' : ''}`}
                      onClick={() => setActiveMeal('lunch')}
                      role="tab"
                      aria-selected={activeMeal === 'lunch'}
                    >
                      <div className="mahalaya-meal-tab__icon-wrap">
                        <span className="mahalaya-meal-tab__icon">🍲</span>
                        <div className="mahalaya-meal-tab__steam" aria-hidden="true">
                          <span className="steam-wisp steam-wisp--1"></span>
                          <span className="steam-wisp steam-wisp--2"></span>
                          <span className="steam-wisp steam-wisp--3"></span>
                        </div>
                      </div>
                      <div className="mahalaya-meal-tab__text">
                        <span className="mahalaya-meal-tab__bn">মহালয়া ভোজ</span>
                        <span className="mahalaya-meal-tab__en">LUNCH FEAST</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {isMahalaya ? (
                <div className="mahalaya-menu-modal__sections" id="mahalaya-menu-sections">
                  {vegDishes.length > 0 && (
                    <div className="mahalaya-menu-diet-section">
                      <button 
                        className="mahalaya-menu-diet-section__header mahalaya-menu-diet-section__header--collapsible"
                        onClick={() => setExpandedDiet(expandedDiet === 'veg' ? null : 'veg')}
                        aria-expanded={expandedDiet === 'veg'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="mahalaya-menu-diet-symbol mahalaya-menu-diet-symbol--veg"></span>
                          <span className="mahalaya-menu-diet-section__label">
                            <span className="mahalaya-menu-diet-section__label-bn">নিরামিষ</span> · VEGETARIAN
                          </span>
                        </div>
                        <span className="mahalaya-menu-diet-section__chevron">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedDiet === 'veg' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </span>
                      </button>
                      <div className="mahalaya-menu-diet-section__collapse" style={{ display: expandedDiet === 'veg' ? 'block' : 'none' }}>
                        <div className="mahalaya-menu-dish-grid">{renderMahalayaDishes(vegDishes)}</div>
                      </div>
                    </div>
                  )}
                  {nonvegDishes.length > 0 && (
                    <div className="mahalaya-menu-diet-section">
                      <button 
                        className="mahalaya-menu-diet-section__header mahalaya-menu-diet-section__header--collapsible"
                        onClick={() => setExpandedDiet(expandedDiet === 'nonveg' ? null : 'nonveg')}
                        aria-expanded={expandedDiet === 'nonveg'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="mahalaya-menu-diet-symbol mahalaya-menu-diet-symbol--nonveg"></span>
                          <span className="mahalaya-menu-diet-section__label">
                            <span className="mahalaya-menu-diet-section__label-bn">আমিষ</span> · NON-VEGETARIAN
                          </span>
                        </div>
                        <span className="mahalaya-menu-diet-section__chevron">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedDiet === 'nonveg' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </span>
                      </button>
                      <div className="mahalaya-menu-diet-section__collapse" style={{ display: expandedDiet === 'nonveg' ? 'block' : 'none' }}>
                        <div className="mahalaya-menu-dish-grid">{renderMahalayaDishes(nonvegDishes)}</div>
                      </div>
                    </div>
                  )}
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
                    <p className="mahalaya-menu-modal__footer-timing">
                      {activeMeal === 'breakfast'
                        ? <>Feast timings: <strong>8:30 AM – 11:00 AM</strong> &bull; Fresh hot breakfast & morning adda</>
                        : <>Feast timings: <strong>1:00 PM – 4:30 PM</strong></>}
                    </p>
                    <p className="mahalaya-menu-modal__footer-closing">পরম্পরার স্বাদে, একসাথে বসে।</p>
                  </>
                ) : (
                  <p>✨ Sit-down lunch timings: <strong>12:30 PM – 3:30 PM</strong> &bull; Free community feast for all attendees with pass</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  )
}
