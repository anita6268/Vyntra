// ──────────────────────────────────────────────────────────────────────────────
// Per-user privacy ("who can see my …") applied when serializing a user for
// OTHER clients. A user always sees their own full record. When someone views
// another user, that user's OWN privacy choices reduce what is returned — never
// the reverse. Callers still authorise the request via protectRoute; this helper
// only decides how much of the profile to expose.
// ──────────────────────────────────────────────────────────────────────────────

// "contacts" means the viewer is someone the owner has NOT blocked.
// A user always sees their own full record (handled by `isSelf` above).
const isContact = (ownerDoc, viewerId) =>
  !(ownerDoc.blockedUsers || []).some((id) => String(id) === String(viewerId));

export const canSeeSetting = (value, contact) => {
  if (value === "nobody") return false;
  if (value === "contacts") return contact;
  return true; // "everyone"
};

/**
 * Return a safe, public-facing copy of a user document for `viewerId`.
 *
 * Strips `lastSeen` / `profilePic` when the owner's privacy hides them, and adds
 * a `showOnline` flag the UI can use to suppress the online dot/status when the
 * owner does not want their online presence visible.
 *
 * @param {mongoose.Document|object} doc  user doc (password NOT selected by callers)
 * @param {string|object} viewerId        current authenticated user id
 * @returns {object} public view
 */
export const sanitizeUserFor = (doc, viewerId) => {
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  delete plain.password;

  const ownerId = String(plain._id);
  const viewer = String(viewerId);
  const isSelf = ownerId === viewer;

  const contact = isContact(plain, viewer);

  const privacy = plain.privacy || {};
  const canSee = (setting) => canSeeSetting(setting, contact);

  return {
    ...plain,
    email: isSelf ? plain.email : "",
    lastSeen: isSelf || canSee(privacy.lastSeenVisibility) ? plain.lastSeen : null,
    profilePic: isSelf || canSee(privacy.profilePicVisibility) ? plain.profilePic : "",
    phone: isSelf || canSee(privacy.phoneVisibility) ? plain.phone : "",
    showOnline: isSelf ? true : canSee(privacy.onlineVisibility),
    username: plain.username || "",
  };
};