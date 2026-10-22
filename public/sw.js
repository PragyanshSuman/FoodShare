// Service worker: receives free Web Push messages and opens the right page on tap.
self.addEventListener("push", (event) => {
  let data = { title: "FoodShare", body: "", link: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { link: data.link || "/dashboard/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.link || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.navigate(url).then((w) => w?.focus());
      return clients.openWindow(url);
    }),
  );
});
