import * as yup from "yup";

export const addProductSchema = yup.object({
  name: yup
    .string()
    .required("Insira um nome para o produto"),
  description: yup
    .string()
    .required("Insira uma descrição para o produto"),
  selectedSubCategory: yup
    .string()
    .required("Selecione uma subcategoria"),
  selectedCategory: yup
    .string()
    .required("Selecione uma categoria"),
  variants: yup
    .array()
    .min(1, "Cadastre pelo menos uma variante do produto")
    .required("Cadastre pelo menos uma variante do produto"),
});