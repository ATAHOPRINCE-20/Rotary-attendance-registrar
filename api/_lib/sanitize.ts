import xss, { IFilterXSSOptions } from 'xss';

const xssOptions: IFilterXSSOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object'],
};

export const sanitize = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return xss(input.trim(), xssOptions);
};

export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

export const sanitizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d\s\+\-]/g, '').trim();
};
