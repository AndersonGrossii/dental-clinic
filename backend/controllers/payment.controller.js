// ============================================
// Controlador de Pagos
// ============================================
import paymentService from '../services/payment.service.js';
import { ApiResponse } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const getAll = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { invoice_id, date_from, date_to, search, payment_method_id } = req.query;

    const { payments, pagination } = await paymentService.getAll({
      page,
      limit,
      invoice_id,
      date_from,
      date_to,
      search,
      payment_method_id,
    });

    return ApiResponse.paginated(res, payments, pagination, 'Pagos obtenidos exitosamente');
  } catch (error) {
    next(error);
  }
};

export const getByInvoice = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const payments = await paymentService.getByInvoice(invoiceId);
    return ApiResponse.success(res, payments, 'Pagos de factura obtenidos');
  } catch (error) {
    next(error);
  }
};

export const getPaymentMethods = async (req, res, next) => {
  try {
    const methods = await paymentService.getPaymentMethods();
    return ApiResponse.success(res, methods, 'Métodos de pago obtenidos');
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payment = await paymentService.create(req.body, userId);
    return ApiResponse.created(res, payment, 'Pago registrado exitosamente');
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await paymentService.delete(id);
    return ApiResponse.success(res, null, 'Pago eliminado exitosamente');
  } catch (error) {
    next(error);
  }
};
