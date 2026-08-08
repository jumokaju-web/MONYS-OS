const policies = [
  {
    id: "use-real-data",
    name: "Utilizar información real",
    description:
      "Las recomendaciones deben basarse en datos reales disponibles y no en información inventada.",
    category: "data",
    active: true,
  },
  {
    id: "protect-business-information",
    name: "Proteger la información empresarial",
    description:
      "La información interna de Monys Glam debe mantenerse protegida y utilizarse únicamente para la operación del sistema.",
    category: "security",
    active: true,
  },
  {
    id: "validate-before-deciding",
    name: "Validar antes de decidir",
    description:
      "Cuando falte información importante, la IA debe señalarlo antes de emitir una recomendación definitiva.",
    category: "intelligence",
    active: true,
  },
  {
    id: "prioritize-profitability",
    name: "Priorizar rentabilidad y liquidez",
    description:
      "Las decisiones deben considerar ventas, margen, gastos, inventario y disponibilidad de efectivo.",
    category: "finance",
    active: true,
  },
  {
    id: "maintain-traceability",
    name: "Mantener trazabilidad",
    description:
      "Los análisis y recomendaciones importantes deben poder relacionarse con los datos que los originaron.",
    category: "audit",
    active: true,
  },
];

export default policies;