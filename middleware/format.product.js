function formatProduct(product) {
  const obj = product.toObject ? product.toObject() : product;

  if (obj.discount) {
    obj.discountPrice = obj.price - (obj.price * obj.discount) / 100;
  }

  if (obj._id && obj.images && obj.images.length > 0) {
    obj.images = obj.images.map(
      (_, index) =>
        `${process.env.URL}/api/products/product/${obj._id}/image/${index}`
    );
  } else {
    obj.images = [];
  }

  return obj;
}

module.exports = formatProduct;
