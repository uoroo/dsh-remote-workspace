/** CSS Modules: the clientBundle preset compiles *.module.css into hashed class maps. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
