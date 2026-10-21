export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const apiSecret = process.env.API_SECRET;

  if (!apiSecret) {
    return next();
  }

  if (token !== apiSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
