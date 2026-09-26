import { Router } from 'express';
import * as controller from './subcategories.controller';

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/reorder', controller.reorder);
router.put('/:id', controller.update);
router.put('/:id/featured-products', controller.setFeaturedProducts);
router.delete('/:id', controller.remove);

export default router;
