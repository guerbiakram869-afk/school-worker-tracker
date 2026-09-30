/**
 * Simple Admin Authentication Middleware
 * Validates the presence and validity of the signed HTTP-only admin_session cookie.
 * No JWT, no complex auth library, no user roles needed.
 */
function requireAdmin(req, res, next) {
  const isAuth = req.signedCookies && req.signedCookies.admin_session === 'authenticated';
  
  if (!isAuth) {
    return res.status(401).json({ 
      error: 'Unauthorized: Admin authentication required' 
    });
  }
  
  next();
}

module.exports = { requireAdmin };
