export class ServiceError extends Error {
  constructor(message, { code = 'SERVICE_ERROR', status = 500, cause } = {}) {
    super(message, { cause });
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}
