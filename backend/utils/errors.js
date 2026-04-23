class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

function mapSupabaseError(error, fallbackMessage = 'Database operation failed.') {
  if (!error) return new AppError(fallbackMessage, 500);

  if (error.code === '23505') {
    return new AppError('Resource already exists.', 409);
  }

  if (error.code === '23503') {
    return new AppError('Referenced resource not found.', 400);
  }

  return new AppError(error.message || fallbackMessage, 500);
}

module.exports = { AppError, mapSupabaseError };
