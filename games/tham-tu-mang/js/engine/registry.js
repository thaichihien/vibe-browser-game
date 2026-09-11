/* Thư viện dị thường. DOM-free ở tầng import — mọi truy cập DOM nằm trong apply().
   tests/ import trực tiếp file này, nên một tham chiếu `document` ở top level của bất kỳ
   file anomalies/* nào cũng sẽ làm hỏng cả bộ test. */

import { TEXT_ANOMALIES } from '../anomalies/text.js';
import { STYLE_ANOMALIES } from '../anomalies/style.js';
import { MOTION_ANOMALIES } from '../anomalies/motion.js';
import { ELEMENT_ANOMALIES } from '../anomalies/element.js';
import { REACTIVE_ANOMALIES } from '../anomalies/reactive.js';
import { IMAGE_ANOMALIES } from '../anomalies/image.js';

export const ANOMALIES = [
  ...TEXT_ANOMALIES,
  ...STYLE_ANOMALIES,
  ...MOTION_ANOMALIES,
  ...ELEMENT_ANOMALIES,
  ...REACTIVE_ANOMALIES,
  ...IMAGE_ANOMALIES
];

export const byId = (id) => ANOMALIES.find((a) => a.id === id) ?? null;
