declare class prettyLog {
    private static isEmpty;
    /**
     * 以花哨的方式在控制台打印标题和文本内容
     * 此函数使用console.log通过CSS样式定制在控制台输出的文本外观
     * 它主要用于调试目的，使控制台输出的信息更易于阅读和区分
     *
     * @param title - 要打印的标题字符串，会以特定样式高亮显示
     * @param text - 要打印的主要文本内容，会以不同的特定样式显示
     * @param color - 用于标题背景和边框的颜色，确保在控制台输出时颜色匹配
     */
    private static prettyPrint;
    /**
     * 根据提供的文本或标题和内容，打印格式化信息
     * 如果内容为空，标题将默认为'Info'，文本为提供的textOrTitle
     * 如果内容非空，标题为提供的textOrTitle，文本为内容
     *
     * @param {string} textOrTitle - 提供的文本或标题
     * @param {string} [content] - 可选的内容，默认为空字符串
     */
    static info(textOrTitle: string, content?: string): void;
    /**
     * 显示错误消息。
     *
     * 此函数接受一个字符串或一个包含标题和内容的对象，并格式化并输出为错误消息。
     * 如果内容为空，则使用 textOrTitle 参数作为错误消息的标题；否则，textOrTitle 参数用作内容，而标题设置为 'Error'。
     *
     * @param textOrTitle 错误消息的标题，或当 content 参数为空时的内容。
     * @param content 错误消息的详细内容，可选。如果此参数为空，则 textOrTitle 参数充当内容。
     */
    static error(textOrTitle: string, content?: string): void;
    /**
     * 显示警告信息
     *
     * 该函数接受一个标题和一个内容参数，当内容为空时，标题默认为'Warning'，否则标题为传入的textOrTitle参数值
     * 内容为空时，使用textOrTitle参数作为内容，否则使用传入的内容
     *
     * @param textOrTitle 标题字符串，当content为空时，同时作为内容字符串
     * @param content 内容字符串，默认为空字符串
     */
    static warning(textOrTitle: string, content?: string): void;
    /**
     * 显示成功信息
     *
     * 该函数接受一个标题和一个内容参数，并根据这些参数生成一个格式化的成功信息
     * 如果内容为空，标题将使用提供的文本，否则使用文本作为内容
     *
     * @param textOrTitle 成功信息的标题或内容，取决于content参数是否提供
     * @param content 成功信息的内容，如果未提供，则默认为空字符串
     */
    static success(textOrTitle: string, content?: string): void;
    /**
     * 在控制台输出带有彩虹渐变色效果的文本
     *
     * 该函数通过console.log输出一个带有特殊CSS样式的字符串，以实现彩虹渐变色效果
     * 参数text将被作为输出文本内容
     *
     * @param text 控制台将显示的文本内容
     */
    static rainbow(text: string): void;
    /**
     * 在控制台中以分组的形式输出信息
     * 这个方法允许以标题和内容数组的形式输出信息，使得控制台的信息更加结构化和易于阅读
     *
     * @param title 分组的标题，将在控制台以特殊样式显示
     * @param content 一个字符串数组，包含要在分组内显示的内容，每项内容都将单独一行显示
     */
    static group(title: string, content: string[]): void;
    /**
     * 将数据以表格形式输出到控制台
     *
     * @param data - 需要输出到控制台的数据数组，类型为任意类型
     */
    static table(data: any[]): void;
    /**
     * 根据提供的URL创建一个图片，并将其按指定比例缩放后显示在控制台中
     * @param url 图片的URL地址
     * @param scale 图片缩放比例，默认为1（不缩放）
     */
    static picture(url: string, scale?: number): void;
}
export default prettyLog;
