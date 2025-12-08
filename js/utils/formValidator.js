// formValidator.js - Validación de formularios reutilizable
/**
 * Validador de formularios genérico
 */
export class FormValidator {
  constructor() {
    this.errors = [];
  }
  
  reset() {
    this.errors = [];
  }
  
  required(value, fieldName) {
    if (!value || value.trim() === '') {
      this.errors.push(`${fieldName} es obligatorio`);
      return false;
    }
    return true;
  }
  
  email(value, fieldName = 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      this.errors.push(`${fieldName} no es válido`);
      return false;
    }
    return true;
  }
  
  time(value, fieldName = 'Hora') {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (value && !timeRegex.test(value)) {
      this.errors.push(`${fieldName} no es válida`);
      return false;
    }
    return true;
  }
  
  timeRange(startTime, endTime) {
    if (startTime && endTime && startTime >= endTime) {
      this.errors.push('La hora de inicio debe ser anterior a la hora de fin');
      return false;
    }
    return true;
  }
  
  date(value, fieldName = 'Fecha') {
    if (value && isNaN(Date.parse(value))) {
      this.errors.push(`${fieldName} no es válida`);
      return false;
    }
    return true;
  }
  
  number(value, fieldName = 'Número') {
    if (value && isNaN(parseFloat(value))) {
      this.errors.push(`${fieldName} debe ser un número`);
      return false;
    }
    return true;
  }
  
  range(value, min, max, fieldName = 'Valor') {
    const num = parseFloat(value);
    if (!isNaN(num) && (num < min || num > max)) {
      this.errors.push(`${fieldName} debe estar entre ${min} y ${max}`);
      return false;
    }
    return true;
  }
  
  minLength(value, length, fieldName = 'Campo') {
    if (value && value.length < length) {
      this.errors.push(`${fieldName} debe tener al menos ${length} caracteres`);
      return false;
    }
    return true;
  }
  
  maxLength(value, length, fieldName = 'Campo') {
    if (value && value.length > length) {
      this.errors.push(`${fieldName} no puede tener más de ${length} caracteres`);
      return false;
    }
    return true;
  }
  
  isValid() {
    return this.errors.length === 0;
  }
  
  getErrors() {
    return this.errors;
  }
  
  showErrors(alertFn = alert) {
    if (this.errors.length > 0) {
      alertFn(this.errors.join('\n'));
    }
  }
}

/**
 * Obtener valores del formulario de forma segura
 */
export function getFormValue(elementId, type = 'text') {
  const element = document.getElementById(elementId);
  if (!element) return type === 'number' ? 0 : '';
  
  const value = element.value;
  
  switch (type) {
    case 'number':
      return parseFloat(value) || 0;
    case 'int':
      return parseInt(value) || 0;
    case 'trim':
      return value.trim();
    case 'boolean':
      return element.checked;
    default:
      return value;
  }
}

/**
 * Establecer valores del formulario de forma segura
 */
export function setFormValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  if (element.type === 'checkbox') {
    element.checked = Boolean(value);
  } else {
    element.value = value || '';
  }
}

/**
 * Limpiar formulario
 */
export function clearForm(elementIds) {
  elementIds.forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    
    if (element.type === 'checkbox') {
      element.checked = false;
    } else {
      element.value = '';
    }
  });
}
