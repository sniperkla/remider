const CACHE_NAME = 'remiderme-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      console.log('Service Worker installed, will check reminders on activation');
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Listen for fetch events - combined handler
self.addEventListener('fetch', (event) => {
  // Special handling for reminder API to schedule notifications
  if (event.request.url.includes('/api/reminders') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).then(response => {
        // After fetching reminders, schedule them
        response.clone().json().then(reminders => {
          reminders.forEach(reminder => {
            if (reminder.status === 'pending') {
              scheduleReminderNotification(reminder);
            }
          });
        }).catch(e => console.log('Could not parse reminders'));
        return response;
      })
    );
  } else {
    // Regular cache-first strategy for other requests
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notification = event.notification;
  const data = notification.data || {};
  
  console.log('Notification clicked:', action, data);
  
  if (action === 'pay') {
    // Mark as paid
    notification.close();
    fetch('/api/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: data.reminderId,
        status: 'paid',
        notified: true 
      })
    }).then(() => {
      // Show success notification
      self.registration.showNotification('✅ สำเร็จ!', {
        body: `บันทึก "${data.description}" จ่ายแล้ว ฿${data.amount.toLocaleString()}`,
        icon: '/icon-192.png',
        tag: 'payment-success',
        requireInteraction: false,
        vibrate: [100, 50, 100]
      });
    }).catch(e => console.log('Could not mark as paid'));
    return;
  }
  
  if (action === 'snooze') {
    // Snooze for 10 minutes
    notification.close();
    const newDate = new Date(Date.now() + 10 * 60 * 1000);
    
    fetch('/api/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: data.reminderId,
        date: newDate.toISOString()
      })
    }).then(() => {
      // Show snooze confirmation
      self.registration.showNotification('⏰ เลื่อนเตือนแล้ว', {
        body: `จะแจ้งเตือนอีกครั้งในอีก 10 นาที`,
        icon: '/icon-192.png',
        tag: 'snooze-success',
        requireInteraction: false,
        vibrate: [100]
      });
      
      // Reschedule the reminder
      fetch('/api/reminders')
        .then(res => res.json())
        .then(reminders => {
          const reminder = reminders.find(r => (r._id || r.id) === data.reminderId);
          if (reminder) scheduleReminderNotification(reminder);
        });
    }).catch(e => console.log('Could not snooze'));
    return;
  }
  
  // Default action - open app
  notification.close();
  const urlToOpen = data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === self.registration.scope && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Periodic background sync for reminders (when app is open or minimized)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotifyReminders());
  }
});

// Message from main app to check reminders immediately
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);
  
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    event.waitUntil(checkAndNotifyReminders());
  }
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    const { reminder } = event.data;
    console.log('Scheduling reminder:', reminder);
    scheduleReminderNotification(reminder);
  }
  if (event.data && event.data.type === 'PING') {
    // Keep-alive ping, just acknowledge
    console.log('Service worker received ping, staying alive...');
  }
});

// Schedule individual reminder using Notification API
function scheduleReminderNotification(reminder) {
  const reminderDate = new Date(reminder.date);
  const now = new Date();
  const delay = reminderDate.getTime() - now.getTime();
  
  console.log('Reminder details:', {
    description: reminder.description,
    date: reminder.date,
    reminderDate: reminderDate.toString(),
    now: now.toString(),
    delay: delay,
    delayMinutes: Math.round(delay/1000/60)
  });
  
  // Clear existing timer for this reminder
  if (scheduledTimers.has(reminder._id || reminder.id)) {
    clearTimeout(scheduledTimers.get(reminder._id || reminder.id));
  }
  
  // Only schedule if in the future and within 24 hours
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    console.log(`✅ Scheduling reminder: ${reminder.description} in ${Math.round(delay/1000/60)} minutes`);
    
    // Show immediate confirmation notification with sound
    self.registration.showNotification('🎉 Reminder.me - ตั้งเตือนสำเร็จ', {
      body: `จะแจ้งเตือน "${reminder.description}" ในอีก ${Math.round(delay/1000/60)} นาที`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `scheduled-${reminder._id || reminder.id}`,
      requireInteraction: false,
      vibrate: [100, 50, 100],
      silent: false
    });
    
    const timerId = setTimeout(() => {
      console.log('🔔 Firing scheduled notification for:', reminder.description);
      self.registration.showNotification('🔔 Reminder.me - แจ้งเตือนบิล', {
        body: `${reminder.description} - ฿${reminder.amount.toLocaleString()}\n\nถึงเวลาจ่ายแล้วค่ะ! 💳`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `reminder-${reminder._id || reminder.id}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200, 100, 400],
        silent: false,
        actions: [
          {
            action: 'pay',
            title: '✅ จ่ายแล้ว',
            icon: '/icon-192.png'
          },
          {
            action: 'snooze',
            title: '⏰ เลื่อน 10 นาที',
            icon: '/icon-192.png'
          }
        ],
        data: { 
          reminderId: reminder._id || reminder.id,
          url: '/',
          amount: reminder.amount,
          description: reminder.description
        }
      });
      
      // Mark as notified
      fetch(`/api/reminders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: reminder._id || reminder.id,
          notified: true 
        })
      }).catch(e => console.log('Could not mark as notified'));
      
      scheduledTimers.delete(reminder._id || reminder.id);
    }, delay);
    
    scheduledTimers.set(reminder._id || reminder.id, timerId);
  }
}

async function checkAndNotifyReminders() {
  try {
    const response = await fetch('/api/reminders');
    if (!response.ok) return;
    
    const reminders = await response.json();
    const now = new Date();
    const today = reminders.filter(r => {
      const remDate = new Date(r.date);
      return remDate.toDateString() === now.toDateString() && r.status === 'pending' && !r.notified;
    });

    if (today.length > 0) {
      for (const reminder of today) {
        const remDate = new Date(reminder.date);
        const diff = Math.abs(now.getTime() - remDate.getTime());
        
        // Only notify if within 1 hour of scheduled time
        if (diff < 60 * 60 * 1000) {
          await self.registration.showNotification('Remider.me - แจ้งเตือนบิล', {
            body: `${reminder.description} - ฿${reminder.amount.toLocaleString()}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `reminder-${reminder._id || reminder.id}`,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: { 
              reminderId: reminder._id || reminder.id,
              url: '/'
            }
          });
          
          // Mark as notified in the database
          try {
            await fetch(`/api/reminders`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                id: reminder._id || reminder.id,
                notified: true 
              })
            });
          } catch (e) {
            console.error('Failed to mark reminder as notified:', e);
          }
        }
      }
    }
  } catch (err) {
    console.error('Periodic sync error:', err);
  }
}

// Store scheduled timers
const scheduledTimers = new Map();

// Wake up and check reminders when service worker activates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => {
      console.log('Service Worker activated, checking reminders...');
      checkAndNotifyReminders();
      scheduleNextCheck();
    })
  );
});

// Schedule next check using alarm
function scheduleNextCheck() {
  // Check every minute for reminders (more reliable than setInterval)
  setTimeout(() => {
    checkAndNotifyReminders().then(() => {
      scheduleNextCheck(); // Reschedule
    });
  }, 60 * 1000); // Check every 1 minute
}
