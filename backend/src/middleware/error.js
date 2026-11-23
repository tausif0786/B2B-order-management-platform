
export function notFound(req, res) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  console.error("API Error:", err?.message || String(err));
  console.error("Error Stack:", err?.stack || "No stack available");

  const status = err.status || err.statusCode || 500;

  res.status(status).json({
    message:
      status === 500
        ? "Something went wrong on the server"
        : err.message,
  });
}
