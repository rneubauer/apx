## Introduction

This data dictionary gives the definitions and characteristics of the
classes, attributes, association roles and enumerations that APX proposes
for the APDS data model. It follows the APDS 4.1 Data Dictionary: the
first part is ordered by UML package, and each package lists its classes,
specializations, associations and attributes; the third part lists the
enumerations alphabetically. No new datatypes are proposed.

Only proposed content is listed. Where a class or enumeration already
exists in APDS 4.1, only the attributes, associations or values proposed
for addition appear, and the class is marked "extends APDS".

The tables use the columns of the APDS 4.1 Data Dictionary:

1. **Class name:** the symbolic name (UpperCamelCase) of the class.
2. **Change:** whether the class is new, or an existing APDS class that
   the proposal extends. This column is added for review and would not
   appear in an adopted data dictionary.
3. **Association end / Attribute name / Enumerated value name:** the
   symbolic name (lowerCamelCase).
4. **Designation:** the name in natural language.
5. **Definition:** the definition of the class, attribute, role or value.
6. **Stereotype:** the stereotype assigned to the class, per EN 16157-1
   Clause 6.1.
7. **Abstract:** whether the class is abstract.
8. **Multiplicity:** the allowed multiplicity, written m..n, where m is
   0 for optional and 1 or more for mandatory, and n is a number or `*`.
9. **Target:** the class at the end of the association.
10. **Type:** the datatype, class or enumeration of the attribute. Where
    an attribute is a reference, the referenced class follows in
    parentheses, as in APDS.
